import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import {
  withFoundationDatabase,
  FOUNDATION_TEST_HASH as H,
} from '../support/finance-ledger-foundation-fixture';
import { withFinanceTestDatabase } from '../support/finance-test-database';
import { requireLease } from '../support/finance-integration-fixture';
import { refreshSourceEnvelope } from '../support/finance-event-fixture';
import { financeConfigurationHash as hash } from '../../src/modules/tenant/billing-commission/foundation/finance-configuration.types';
import { FinancePolicyGovernance1797100000000 } from '../../src/database/migrations/1797100000000-FinancePolicyGovernance';
import { FinanceLedgerFoundation1797200000000 } from '../../src/database/migrations/1797200000000-FinanceLedgerFoundation';
import { FinanceFoundationController } from '../../src/modules/tenant/billing-commission/foundation/finance-foundation.controller';
import { FinanceLedgerFoundationService } from '../../src/modules/tenant/billing-commission/foundation/finance-ledger-foundation.service';
import { FinancePolicyService } from '../../src/modules/tenant/billing-commission/foundation/finance-policy.service';
import { FinanceJournalCandidateService } from '../../src/modules/tenant/billing-commission/foundation/finance-journal-candidate.service';
import { FinanceApprovalService } from '../../src/modules/tenant/billing-commission/foundation/finance-approval.service';
import { FOUNDATION_CHECKS } from '../../src/modules/tenant/billing-commission/foundation/finance-ledger-foundation.types';
const db = withFoundationDatabase;
describe('B43-B45 integrated ledger and release controls on disposable PostgreSQL', () => {
  it('LF01 migrates only empty structures and restores an unused migration', () =>
    withFinanceTestDatabase(
      async ({ dataSource: s }) => {
        const q = s.createQueryRunner();
        try {
          await new FinancePolicyGovernance1797100000000().up(q);
          const migration = new FinanceLedgerFoundation1797200000000();
          await migration.up(q);
          expect(
            (
              await s.query(
                'SELECT count(*)::integer n FROM finance_foundation_journals',
              )
            )[0].n,
          ).toBe(0);
          await migration.down(q);
          expect(
            (
              await s.query(
                "SELECT to_regclass('finance_foundation_journals') t",
              )
            )[0].t,
          ).toBeNull();
        } finally {
          await q.release();
        }
      },
      process.env,
      'journal-candidates',
    ));
  it('LF02 persists exact source/functional vectors and keeps validation financially inactive', () =>
    db(async (f) => {
      const candidate = await f.prepareLedger(),
        accepted = await f.acceptLedger(candidate),
        entry = await f.ledger.journal(
          f.checker,
          f.scope,
          accepted.journalId,
          'VALIDATION',
        );
      expect(accepted).toMatchObject({
        financialEffects: 0,
        mode: 'VALIDATION',
      });
      expect(entry).toMatchObject({
        transaction_currency: 'USD',
        functional_currency: 'TZS',
        transaction_date: f.today,
        accounting_date: f.today,
      });
      const [sums] = await f.source.query(
        'SELECT sum(transaction_debit)::text td,sum(transaction_credit)::text tc,sum(functional_debit)::text fd,sum(functional_credit)::text fc FROM finance_foundation_lines',
      );
      expect(sums).toEqual({
        td: '25.125000000000',
        tc: '25.125000000000',
        fd: '62812.500000000000',
        fc: '62812.500000000000',
      });
      expect(
        (
          await f.source.query(
            'SELECT state FROM finance_accounting_books WHERE id=$1',
            [f.scope.bookId],
          )
        )[0].state,
      ).toBe('DRAFT');
    }));
  it('LF03 requires no foreign-rate record for exact same-currency parity', () =>
    db(
      async (f) => {
        const p = await f.prepareLedger(),
          r = await f.acceptLedger(p),
          j = await f.ledger.journal(
            f.checker,
            f.scope,
            r.journalId,
            'VALIDATION',
          );
        expect(j.rate_id).toBeNull();
        expect(
          j.payload.lines.find(
            (line: { lineKey: string }) => line.lineKey === 'DR',
          ).functionalDebit,
        ).toBe('25.125000000000');
      },
      { functional: 'USD' },
    ));
  it('LF04 rejects absent FX evidence before any journal/header can persist', () =>
    db(async (f) => {
      const p = await f.prepareLedger();
      await expect(
        f.ledger.acceptCandidate(
          f.checker,
          f.scope,
          { ...f.ledgerInput(p), rateId: null, rateHash: null },
          'Missing rate must hold',
        ),
      ).rejects.toThrow('exact reviewed rate');
      expect(
        (
          await f.source.query(
            'SELECT count(*)::integer n FROM finance_foundation_journals',
          )
        )[0].n,
      ).toBe(0);
    }));
  it('LF05 rejects source precision inconsistent with the reviewed context', () =>
    db(async (f) => {
      const p = f.input();
      p.accountingDate = f.today;
      p.economicSourceId = 'wrong-scale';
      p.decimalScale = 2;
      p.lines[0].debit = '25.12';
      p.lines[1].credit = '25.12';
      const c = await f.validate(await f.prepare(p));
      await expect(f.acceptLedger(c)).rejects.toThrow('precision');
    }));
  it('LF06 forbids context review by the preparer or their second login', () =>
    db(async (f) => {
      const c = await f.ledger.prepareCurrencyContext(
        f.maker,
        f.scope,
        { ...f.config, version: 2 },
        'Second configuration proposal',
      );
      for (const actor of [f.maker, f.alias])
        await expect(
          f.ledger.reviewDocument(
            actor,
            f.scope,
            c.id,
            c.subjectHash,
            'REVIEWED',
            H,
            'Self review is not allowed',
          ),
        ).rejects.toThrow('natural person');
    }));
  it('LF07 rejects a revoked acceptance mandate without changing balances', () =>
    db(async (f) => {
      const p = await f.prepareLedger();
      await f.source.query(
        "UPDATE finance_foundation_authorities SET revoked_at=statement_timestamp() WHERE subject_id=$1 AND capability='ACCEPT'",
        [f.checker.subjectId],
      );
      await expect(f.acceptLedger(p)).rejects.toThrow('mandate');
      expect(
        (
          await f.source.query(
            'SELECT count(*)::integer n FROM finance_foundation_journals',
          )
        )[0].n,
      ).toBe(0);
    }));
  it('LF08 closes/reopens only an exact period revision with recorded admin authority', () =>
    db(async (f) => {
      const p = await f.prepareLedger(),
        closed = await f.ledger.fencePeriod(
          f.admin,
          f.scope,
          f.ledgerPeriod.id,
          1,
          'CLOSED',
          H,
          'Explicit close',
        );
      await expect(f.acceptLedger(p)).rejects.toThrow('open ledger period');
      await expect(
        f.ledger.fencePeriod(
          f.admin,
          f.scope,
          f.ledgerPeriod.id,
          1,
          'OPEN',
          H,
          'Stale reopen',
        ),
      ).rejects.toThrow('stale');
      const opened = await f.ledger.fencePeriod(
        f.admin,
        f.scope,
        f.ledgerPeriod.id,
        closed.revision,
        'OPEN',
        H,
        'Independent approved reopen',
      );
      expect(opened.revision).toBe(3);
      expect(await f.acceptLedger(p)).toMatchObject({ financialEffects: 0 });
    }));
  it('LF09 serializes concurrent retries into one immutable journal', () =>
    db(async (f) => {
      const p = await f.prepareLedger(),
        r = await Promise.all([f.acceptLedger(p), f.acceptLedger(p)]);
      expect(r.filter((x) => !x.reused)).toHaveLength(1);
      expect(new Set(r.map((x) => x.journalId)).size).toBe(1);
      expect(
        (
          await f.source.query(
            'SELECT count(*)::integer n FROM finance_foundation_journals',
          )
        )[0].n,
      ).toBe(1);
    }));
  it('LF10 denies changed-source retries and economic-source revision double counting', () =>
    db(async (f) => {
      const p = await f.prepareLedger();
      await f.acceptLedger(p);
      await expect(
        f.ledger.acceptCandidate(
          f.checker,
          f.scope,
          {
            ...f.ledgerInput(p),
            source: {
              kind: 'MANUAL',
              reference: 'Changed source',
              evidenceHash: H,
            },
          },
          'Changed retry',
        ),
      ).rejects.toThrow('retried');
      await expect(f.prepareLedger({ revision: '2' })).rejects.toThrow();
      expect(
        (
          await f.source.query(
            'SELECT count(*)::integer n FROM finance_foundation_journals',
          )
        )[0].n,
      ).toBe(1);
    }));
  it('LF11 denies cross-book and cross-tenant financial reads even with another book mandate', () =>
    db(async (f) => {
      const j = await f.acceptLedger(await f.prepareLedger()),
        scope = { ...f.scope, bookId: f.books[1].id };
      await f.ledgerGrant(f.checker, 'READ', 'FINANCE_OPERATOR', scope.bookId);
      await expect(
        f.ledger.journal(f.checker, scope, j.journalId, 'VALIDATION'),
      ).rejects.toThrow('unavailable');
      await expect(
        f.ledger.journal(
          { ...f.checker, tenantId: randomUUID() },
          f.scope,
          j.journalId,
          'VALIDATION',
        ),
      ).rejects.toThrow('scope');
      await expect(
        f.ledger.trialBalance(f.checker, scope, {
          mode: 'VALIDATION',
          openingId: f.opening.id,
          openingHash: f.opening.subjectHash,
          from: '2026-11-01',
          to: '2026-12-01',
        }),
      ).rejects.toThrow();
    }));
  it('LF12 re-verifies a real B11 signed accepted fact and its candidate lineage', () =>
    db(
      async (f) => {
        const i = f.integration!,
          event = i.envelope();
        const snapshot = {
          amount: '25.125',
          currency: 'USD',
          transactionDate: f.today,
          companyId: f.companyId,
          sourceId: event.aggregate.id,
        };
        event.payload.snapshot_hash = hash(snapshot);
        refreshSourceEnvelope(event);
        const captured = await i.capture(event);
        await i.intake.process(
          i.worker,
          requireLease(await i.intake.claim(i.worker, captured.intakeId)),
        );
        const [intake] = await f.source.query(
            'SELECT preview_id FROM finance_integration_intakes WHERE id=$1',
            [captured.intakeId],
          ),
          [box] = await f.source.query(
            'SELECT id FROM finance_integration_inboxes WHERE preview_id=$1 AND book_id=$2',
            [intake.preview_id, f.scope.bookId],
          );
        const p = await f.prepareLedger({
            sourceId: event.aggregate.id,
            revision: String(event.aggregate.revision),
          }),
          input = f.ledgerInput(p);
        input.source = {
          kind: 'ACCEPTED_INBOX',
          reference: 'Actual private signed intake',
          snapshot,
          evidenceHash: H,
          inboxId: box.id,
          expected: {
            eventType: event.event_type,
            factKind: 'CONFIRMED_RECEIPT',
            aggregateType: event.aggregate.type,
            aggregateId: event.aggregate.id,
            companyId: event.source_company_id,
            revision: event.aggregate.revision,
            snapshotHash: event.payload.snapshot_hash,
          },
        };
        await expect(
          f.ledger.acceptCandidate(
            f.checker,
            f.scope,
            {
              ...input,
              source: {
                ...input.source,
                expected: {
                  ...input.source.expected!,
                  snapshotHash: 'b'.repeat(64),
                },
              },
            },
            'Wrong snapshot',
          ),
        ).rejects.toThrow();
        expect(
          await f.ledger.acceptCandidate(
            f.checker,
            f.scope,
            input,
            'Accepted signature and exact candidate binding',
          ),
        ).toMatchObject({ financialEffects: 0 });
        await expect(
          f.ledger.acceptCandidate(
            f.checker,
            f.scope,
            f.ledgerInput(p),
            'Manual substitution of signed fact',
          ),
        ).rejects.toThrow('signed accepted');
      },
      { signed: true },
    ));
  it('LF13 never invents an opening or accepts an incomplete account population', () =>
    db(async (f) => {
      await expect(
        f.ledger.trialBalance(f.checker, f.scope, {
          mode: 'VALIDATION',
          openingId: randomUUID(),
          openingHash: H,
          from: '2026-11-01',
          to: '2026-12-01',
        }),
      ).rejects.toThrow();
      await expect(
        f.ledger.prepareOpening(
          f.maker,
          f.scope,
          {
            contextId: f.context.id,
            contextHash: f.context.subjectHash,
            mode: 'VALIDATION',
            date: '2026-11-02',
            balances: [{ accountCode: '110110', signedBalance: '0' }],
            sourceReference: 'Incomplete source',
            sourceEvidenceHash: H,
            explicitZeroReason: null,
          },
          1,
          'Incomplete opening',
        ),
      ).rejects.toThrow('every posting account');
    }));
  it('LF14 rolls activity before the reporting window into opening without a balancing plug', () =>
    db(async (f) => {
      await f.acceptLedger(
        await f.prepareLedger({ sourceId: 'first', date: '2026-11-17' }),
      );
      await f.acceptLedger(
        await f.prepareLedger({ sourceId: 'second', date: '2026-11-18' }),
      );
      const r = await f.ledger.trialBalance(f.checker, f.scope, {
        mode: 'VALIDATION',
        openingId: f.opening.id,
        openingHash: f.opening.subjectHash,
        from: '2026-11-18',
        to: '2026-11-19',
      });
      expect(r.rows.find((x) => x.accountCode === '110110')).toMatchObject({
        opening: '62812.500000000000',
        debit: '62812.500000000000',
        closing: '125625.000000000000',
      });
      expect(r.totalDebit).toBe(r.totalCredit);
    }));
  it('LF15 reverses original carrying vectors once without creating fresh FX', () =>
    db(async (f) => {
      const p = await f.prepareLedger(),
        original = await f.acceptLedger(p),
        input = f.input();
      input.accountingDate = '2026-11-20';
      input.economicSourceId = 'foundation-source';
      input.correctionOf = { id: p.id, hash: p.subject_hash };
      input.lines = input.lines.map((l) => ({
        ...l,
        debit: l.credit,
        credit: l.debit,
      }));
      const reversed = await f.validate(await f.prepare(input));
      const j = await f.ledger.acceptCandidate(
        f.checker,
        f.scope,
        { ...f.ledgerInput(reversed), transactionDate: '2026-11-20' },
        'Reverse the original carrying amount after rate age limit',
      );
      expect(
        (await f.ledger.journal(f.checker, f.scope, j.journalId, 'VALIDATION'))
          .reversal_of,
      ).toBe(original.journalId);
      const r = await f.reportLedger();
      expect(r.rows.every((x) => x.closing === '0.000000000000')).toBe(true);
    }));
  it('LF16 preserves accepted history against update/delete/truncate and unused-migration rollback', () =>
    db(async (f) => {
      const j = await f.acceptLedger(await f.prepareLedger());
      await expect(
        f.source.query(
          'UPDATE finance_foundation_journals SET subject_hash=$1 WHERE id=$2',
          ['b'.repeat(64), j.journalId],
        ),
      ).rejects.toThrow('append-only');
      await expect(
        f.source.query(
          'DELETE FROM finance_foundation_lines WHERE journal_id=$1',
          [j.journalId],
        ),
      ).rejects.toThrow('append-only');
      await expect(
        f.source.query('TRUNCATE finance_foundation_journal_audits'),
      ).rejects.toThrow('append-only');
      const q = f.source.createQueryRunner();
      try {
        await expect(
          new FinanceLedgerFoundation1797200000000().down(q),
        ).rejects.toThrow('rollback');
      } finally {
        await q.release();
      }
    }));
  it('LF17 detects stale B45 report populations instead of approving old evidence', () =>
    db(async (f) => {
      const a = await f.ledger.prepareAcceptance(
        f.maker,
        f.scope,
        {
          contextId: f.context.id,
          contextHash: f.context.subjectHash,
          openingId: f.opening.id,
          openingHash: f.opening.subjectHash,
          from: '2026-11-01',
          to: '2026-12-01',
          checks: FOUNDATION_CHECKS.map((code) => ({
            code,
            evidenceHash: H,
            reference: 'Synthetic evidence ' + code,
          })),
          compatibilityEvidenceHash: H,
          historicalProtectionHash: H,
          scopeReference: 'Test only',
        },
        1,
        'Freeze acceptance before new activity',
      );
      await f.acceptLedger(await f.prepareLedger());
      await expect(
        f.ledger.reviewDocument(
          f.checker,
          f.scope,
          a.id,
          a.subjectHash,
          'REVIEWED',
          H,
          'Outdated acceptance',
        ),
      ).rejects.toThrow('population changed');
    }));
  it('LF18 technical acceptance does not approve policies, activate a book or release production', () =>
    db(async (f) => {
      await f.acceptLedger(await f.prepareLedger());
      await f.technicalAcceptance();
      expect(
        await f.ledger.readiness(
          f.checker,
          f.scope,
          f.context.id,
          f.context.subjectHash,
        ),
      ).toMatchObject({
        technicalAcceptance: true,
        productionEligible: false,
        policyActivation: false,
      });
      expect(
        (
          await f.source.query(
            'SELECT count(*)::integer n FROM finance_policy_versions',
          )
        )[0].n,
      ).toBe(0);
      expect(
        (
          await f.source.query(
            'SELECT count(*)::integer n FROM finance_foundation_deployments',
          )
        )[0].n,
      ).toBe(0);
    }));
  it('LF19 company-admin release approval still cannot silently activate policies or the ledger', () =>
    db(
      async (f) => {
        await f.acceptLedger(await f.prepareLedger());
        const { r } = await f.prepareLedgerRelease();
        await expect(
          f.ledger.deployment(
            f.admin,
            f.scope,
            r.id,
            r.subjectHash,
            'ENABLE',
            'No implicit policy activation',
          ),
        ).rejects.toThrow('ACTIVE');
        expect(
          (
            await f.source.query(
              "SELECT count(*)::integer n FROM finance_policy_events WHERE to_state='ACTIVE'",
            )
          )[0].n,
        ).toBe(0);
        expect(
          (
            await f.source.query(
              'SELECT state FROM finance_accounting_books WHERE id=$1',
              [f.scope.bookId],
            )
          )[0].state,
        ).toBe('DRAFT');
      },
      { policies: true },
    ));
  it('LF20 exercises live-mode posting only after explicit synthetic company-admin approvals and activation', () =>
    db(
      async (f) => {
        const p = await f.prepareLedger();
        await f.acceptLedger(p);
        const { liveOpening } = await f.enableLedger();
        expect(await f.acceptLedger(p, 'LIVE')).toMatchObject({
          mode: 'LIVE',
          financialEffects: 1,
        });
        const report = await f.ledger.trialBalance(f.checker, f.scope, {
          mode: 'LIVE',
          openingId: liveOpening.id,
          openingHash: liveOpening.subjectHash,
          from: f.today,
          to: '2026-12-01',
        });
        expect(report.totalDebit).toBe('62812.500000000000');
        expect(
          (
            await f.source.query(
              "SELECT count(*)::integer n FROM finance_foundation_journals WHERE mode='VALIDATION'",
            )
          )[0].n,
        ).toBe(1);
        expect(
          (
            await f.source.query(
              "SELECT count(*)::integer n FROM finance_foundation_journals WHERE mode='LIVE'",
            )
          )[0].n,
        ).toBe(1);
      },
      { policies: true },
    ));
  it('LF21 disabling blocks new live effects while preserving prior journal evidence', () =>
    db(
      async (f) => {
        const p = await f.prepareLedger();
        const { r } = await f.enableLedger();
        const j = await f.acceptLedger(p, 'LIVE');
        await f.ledger.deployment(
          f.admin,
          f.scope,
          r.id,
          r.subjectHash,
          'DISABLE',
          'Explicit synthetic suspension',
        );
        await expect(
          f.acceptLedger(
            await f.prepareLedger({ sourceId: 'after-disable' }),
            'LIVE',
          ),
        ).rejects.toThrow('Live ledger');
        expect(
          (await f.ledger.journal(f.checker, f.scope, j.journalId, 'LIVE'))
            .subject_hash,
        ).toBe(j.subjectHash);
      },
      { policies: true },
    ));
  it('LF22 policy retirement immediately holds new live journals', () =>
    db(
      async (f) => {
        const p = await f.prepareLedger();
        await f.enableLedger();
        await f.acceptLedger(p, 'LIVE');
        const pin = f.config.policyPins[0];
        await f.policy.transition(
          { tenantId: f.tenantId, ...f.scope },
          f.admin,
          pin.id,
          pin.hash,
          'DEACTIVATE',
          H,
          'Explicit synthetic policy retirement',
        );
        await expect(
          f.acceptLedger(
            await f.prepareLedger({ sourceId: 'after-retirement' }),
            'LIVE',
          ),
        ).rejects.toThrow('ACTIVE');
        expect(
          (
            await f.source.query(
              "SELECT count(*)::integer n FROM finance_foundation_journals WHERE mode='LIVE'",
            )
          )[0].n,
        ).toBe(1);
      },
      { policies: true },
    ));
  it('LF23 rechecks trusted identity revocation between resolution and financial read', () =>
    db(async (f) => {
      const b = await f.bind(f.checker),
        actor = await f.ledger.resolveIdentity(
          { id: b.userId, companyId: b.companyId },
          f.scope,
        );
      await f.source.query(
        'UPDATE finance_foundation_identity_bindings SET revoked_at=statement_timestamp() WHERE id=$1',
        [b.id],
      );
      await expect(
        f.ledger.readiness(actor, f.scope, f.context.id, f.context.subjectHash),
      ).rejects.toThrow('binding');
      await expect(
        f.ledger.resolveIdentity(
          { id: b.userId, companyId: randomUUID() },
          f.scope,
        ),
      ).rejects.toThrow('binding');
    }));
  it('LF24 serves real scoped HTTP trial balance and denies an unbound company identity', () =>
    db(async (f) => {
      await f.acceptLedger(await f.prepareLedger());
      const b = await f.bind(f.checker);
      let user: any = {
        id: b.userId,
        companyId: b.companyId,
        scope: 'company',
        userType: 'COMPANY_USER',
      };
      const module = await Test.createTestingModule({
          controllers: [FinanceFoundationController],
          providers: [
            { provide: FinanceLedgerFoundationService, useValue: f.ledger },
            { provide: FinancePolicyService, useValue: f.policy },
          ],
        }).compile(),
        app = module.createNestApplication();
      app.use((req: any, _res: any, next: () => void) => {
        req.user = user;
        next();
      });
      await app.init();
      try {
        const query = {
          ...f.scope,
          mode: 'VALIDATION',
          openingId: f.opening.id,
          openingHash: f.opening.subjectHash,
          from: '2026-11-01',
          to: '2026-12-01',
        };
        const r = await request(app.getHttpServer())
          .get('/tenant/finance/foundation/trial-balance')
          .query(query)
          .expect(200);
        expect(r.body.totalDebit).toBe('62812.500000000000');
        user = { ...user, companyId: randomUUID() };
        await request(app.getHttpServer())
          .get('/tenant/finance/foundation/trial-balance')
          .query(query)
          .expect(403);
      } finally {
        await app.close();
      }
    }));
  it('LF25 requires explicit currency/amount bounds rather than unlimited acceptance', () =>
    db(async (f) => {
      await expect(
        f.acceptLedger(await f.prepareLedger({ amount: '1000000.001' })),
      ).rejects.toThrow('currency and amount');
      await expect(
        f.source.query(
          "INSERT INTO finance_foundation_authorities(tenant_id,legal_entity_id,book_id,subject_id,natural_person_id,capability,company_role,authority_reference,valid_from,limits) VALUES($1,$2,$3,$4,$5,'ACCEPT','FINANCE_OPERATOR','INVALID-UNLIMITED','2020-01-01','{}')",
          [f.tenantId, f.entity.id, f.scope.bookId, randomUUID(), randomUUID()],
        ),
      ).rejects.toThrow();
      expect(
        (
          await f.source.query(
            'SELECT count(*)::integer n FROM finance_foundation_journals',
          )
        )[0].n,
      ).toBe(0);
    }));
  it('LF26 exposes only bound scopes and exact reviewable documents and policy audit chains', () =>
    db(
      async (f) => {
        const b = await f.bind(f.checker);
        expect(
          await f.ledger.scopes({ id: b.userId, companyId: b.companyId }),
        ).toEqual([
          expect.objectContaining({
            tenantId: f.tenantId,
            legalEntityId: f.scope.legalEntityId,
            bookId: f.scope.bookId,
          }),
        ]);
        expect(
          await f.ledger.scopes({ id: b.userId, companyId: randomUUID() }),
        ).toEqual([]);
        expect(
          await f.ledger.documents(f.checker, f.scope, 'CURRENCY_CONTEXT'),
        ).toEqual([
          expect.objectContaining({ id: f.context.id, state: 'REVIEWED' }),
        ]);
        expect(
          (
            await f.ledger.documentDetails(
              f.checker,
              f.scope,
              f.context.id,
              f.context.subjectHash,
            )
          ).payload,
        ).toEqual(f.config);
        const pin = f.config.policyPins[0];
        expect(
          await f.ledger.policyDetails(
            f.checker,
            f.scope,
            pin.id.toUpperCase(),
            pin.hash,
          ),
        ).toMatchObject({ state: 'APPROVED', financialEffects: 0 });
        await expect(
          f.ledger.documents(f.checker, f.scope, undefined, 1001),
        ).rejects.toThrow('bounded');
      },
      { policies: true },
    ));
  it('LF27 seals accepted lines against a later append, not just update/delete', () =>
    db(async (f) => {
      const j = await f.acceptLedger(await f.prepareLedger());
      await expect(
        f.source.query(
          "INSERT INTO finance_foundation_lines SELECT tenant_id,legal_entity_id,book_id,journal_id,'EXTRA',account_code,role_code,transaction_debit,transaction_credit,functional_debit,functional_credit,rounding_debit,rounding_credit,dimensions FROM finance_foundation_lines WHERE journal_id=$1 LIMIT 1",
          [j.journalId],
        ),
      ).rejects.toThrow('sealed');
      expect(
        (
          await f.source.query(
            'SELECT count(*)::integer n FROM finance_foundation_lines',
          )
        )[0].n,
      ).toBe(2);
    }));
  it('LF28 independently rejects a corrupted functional vector at database commit', () =>
    db(async (f) => {
      const original = await f.acceptLedger(await f.prepareLedger()),
        candidate = await f.prepareLedger({ sourceId: 'raw-corruption' });
      await expect(
        rawClone(f, original.journalId, candidate, true),
      ).rejects.toThrow('Both journal currency vectors');
      expect(
        (
          await f.source.query(
            'SELECT count(*)::integer n FROM finance_foundation_journals',
          )
        )[0].n,
      ).toBe(1);
    }));
  it('LF29 database controls reject raw live writes after policy retirement', () =>
    db(
      async (f) => {
        const p = await f.prepareLedger();
        await f.enableLedger();
        const original = await f.acceptLedger(p, 'LIVE'),
          pin = f.config.policyPins[0];
        await f.policy.transition(
          { tenantId: f.tenantId, ...f.scope },
          f.admin,
          pin.id,
          pin.hash,
          'DEACTIVATE',
          H,
          'Explicit test retirement',
        );
        const next = await f.prepareLedger({ sourceId: 'raw-retired-policy' });
        await expect(
          rawClone(f, original.journalId, next, false),
        ).rejects.toThrow('Every exact company policy');
        expect(
          (
            await f.source.query(
              "SELECT count(*)::integer n FROM finance_foundation_journals WHERE mode='LIVE'",
            )
          )[0].n,
        ).toBe(1);
      },
      { policies: true },
    ));
  it('LF30 exercises the public preparation, independent approval, validation and ledger API chain', () =>
    db(async (f) => {
      const maker = await f.bind(f.maker),
        checker = await f.bind(f.checker);
      let user: any = {
        id: maker.userId,
        companyId: maker.companyId,
        scope: 'company',
        userType: 'COMPANY_USER',
      };
      const module = await Test.createTestingModule({
          controllers: [FinanceFoundationController],
          providers: [
            { provide: FinanceLedgerFoundationService, useValue: f.ledger },
            { provide: FinancePolicyService, useValue: f.policy },
            { provide: FinanceJournalCandidateService, useValue: f.service },
            { provide: FinanceApprovalService, useValue: f.approvals },
          ],
        }).compile(),
        app = module.createNestApplication();
      app.use((req: any, _res: any, next: () => void) => {
        req.user = user;
        next();
      });
      await app.init();
      try {
        const input = f.input();
        input.accountingDate = f.today;
        const candidate = (
          await request(app.getHttpServer())
            .post('/tenant/finance/foundation/journal-candidates')
            .send({
              scope: f.scope,
              input,
              reason: 'Synthetic HTTP source preparation',
            })
            .expect(201)
        ).body;
        const token = (
          await request(app.getHttpServer())
            .post(
              '/tenant/finance/foundation/journal-candidates/' +
                candidate.id +
                '/approval-requests',
            )
            .send({
              scope: f.scope,
              subjectHash: candidate.subject_hash,
              profileId: f.profile.id,
              profileHash: f.profile.release_hash,
              beneficiary: {
                mode: 'NOT_APPLICABLE',
                reason: 'No payee in this synthetic source journal',
              },
              reason: 'Freeze the actual candidate subject',
            })
            .expect(201)
        ).body;
        user = { ...user, id: checker.userId };
        await request(app.getHttpServer())
          .post(
            '/tenant/finance/foundation/approval-requests/' +
              token.requestId +
              '/decisions',
          )
          .send({
            scope: f.scope,
            token,
            mandateId: f.checkerMandate.id,
            action: 'APPROVED_INACTIVE',
            reason: 'Independent synthetic checker',
          })
          .expect(201);
        await request(app.getHttpServer())
          .post(
            '/tenant/finance/foundation/journal-candidates/' +
              candidate.id +
              '/validation',
          )
          .send({
            scope: f.scope,
            subjectHash: candidate.subject_hash,
            token,
            reason: 'Validate without production effects',
          })
          .expect(201);
        const accepted = (
          await request(app.getHttpServer())
            .post('/tenant/finance/foundation/journal-acceptances')
            .send({
              scope: f.scope,
              input: f.ledgerInput(candidate),
              reason: 'Explicit ledger acceptance of reviewed source',
            })
            .expect(201)
        ).body;
        expect(accepted).toMatchObject({
          mode: 'VALIDATION',
          financialEffects: 0,
        });
        await request(app.getHttpServer())
          .get('/tenant/finance/foundation/scopes')
          .expect(200);
      } finally {
        await app.close();
      }
    }));
  it('LF31 reviewing an inactive successor chart cannot silently replace or disable the separately approved live chart', () =>
    db(
      async (f) => {
        await f.enableLedger();
        const draft = await f.chartConfiguration.createDraft(
          f.maker,
          f.scope,
          {
            kind: 'ACCOUNT_ROLES',
            key: 'TEST',
            version: 2,
            effectiveFrom: '2026-01-01',
            dependencyRefs: f.chart.dependency_refs,
            payload: f.chart.payload.proposal as Record<string, unknown>,
            supersedesId: f.chart.id,
          },
          'Propose successor without activating it',
        );
        await f.chartConfiguration.submit(
          f.maker,
          f.scope,
          draft.id,
          draft.release_hash,
          'Submit inactive successor',
        );
        const successor = await f.chartConfiguration.reviewInactive(
          f.checker,
          f.scope,
          draft.id,
          draft.release_hash,
          'REVIEWED_INACTIVE',
          'Review without changing the live release',
        );
        const j = await f.acceptLedger(
          await f.prepareLedger({ sourceId: 'retained-live-chart' }),
          'LIVE',
        );
        const record = await f.ledger.journal(
          f.checker,
          f.scope,
          j.journalId,
          'LIVE',
        );
        expect(record.payload.context.chartReleaseId).toBe(f.chart.id);
        expect(record.payload.context.chartReleaseId).not.toBe(successor.id);
      },
      { policies: true },
    ));
  it('LF32 independent candidate approval cannot bypass the context posting-rule vector', () =>
    db(async (f) => {
      const p = f.input();
      p.accountingDate = f.today;
      p.economicSourceId = 'wrong-posting-role';
      p.lines[1].roleCode = 'BANK';
      p.lines[1].dimensions = { CURRENCY: 'USD' };
      const candidate = await f.validate(await f.prepare(p));
      await expect(f.acceptLedger(candidate)).rejects.toThrow(
        'component posting rule',
      );
      expect(
        (
          await f.source.query(
            'SELECT count(*)::integer n FROM finance_foundation_journals',
          )
        )[0].n,
      ).toBe(0);
    }));
  it('LF33 rejects an approved candidate whose amount differs from an authentically signed financial snapshot', () =>
    db(
      async (f) => {
        const i = f.integration!,
          event = i.envelope(),
          snapshot = {
            amount: '100',
            currency: 'USD',
            transactionDate: f.today,
            companyId: f.companyId,
            sourceId: event.aggregate.id,
          };
        event.payload.snapshot_hash = hash(snapshot);
        refreshSourceEnvelope(event);
        const captured = await i.capture(event);
        await i.intake.process(
          i.worker,
          requireLease(await i.intake.claim(i.worker, captured.intakeId)),
        );
        const [intake] = await f.source.query(
            'SELECT preview_id FROM finance_integration_intakes WHERE id=$1',
            [captured.intakeId],
          ),
          [box] = await f.source.query(
            'SELECT id FROM finance_integration_inboxes WHERE preview_id=$1 AND book_id=$2',
            [intake.preview_id, f.scope.bookId],
          );
        const candidate = await f.prepareLedger({
            sourceId: event.aggregate.id,
          }),
          input = f.ledgerInput(candidate);
        input.source = {
          kind: 'ACCEPTED_INBOX',
          reference: 'Actual private signed payment snapshot',
          evidenceHash: H,
          inboxId: box.id,
          snapshot,
          expected: {
            eventType: event.event_type,
            factKind: 'CONFIRMED_RECEIPT',
            aggregateType: event.aggregate.type,
            aggregateId: event.aggregate.id,
            companyId: f.companyId,
            revision: event.aggregate.revision,
            snapshotHash: hash(snapshot),
          },
        };
        await expect(
          f.ledger.acceptCandidate(
            f.checker,
            f.scope,
            input,
            'The signed source is 100; the candidate is 25.125',
          ),
        ).rejects.toThrow('differ from the signed financial snapshot');
        expect(
          (
            await f.source.query(
              'SELECT count(*)::integer n FROM finance_foundation_journals',
            )
          )[0].n,
        ).toBe(0);
      },
      { signed: true },
    ));
});

/** Deliberately bypasses the service in an owned test DB to challenge DB invariants. */
async function rawClone(
  f: any,
  originalId: string,
  candidate: any,
  corrupt: boolean,
) {
  const id = randomUUID();
  return f.source.transaction(async (m: any) => {
    await m.query(
      "INSERT INTO finance_foundation_journals OVERRIDING USER VALUE SELECT x.* FROM finance_foundation_journals j CROSS JOIN LATERAL jsonb_populate_record(NULL::finance_foundation_journals,to_jsonb(j)||jsonb_build_object('id',$1::text,'candidate_id',$2::text,'candidate_hash',$3::text,'economic_key',$4::text)) x WHERE j.id=$5",
      [
        id,
        candidate.id,
        candidate.subject_hash,
        candidate.economic_key,
        originalId,
      ],
    );
    await m.query(
      'INSERT INTO finance_foundation_lines SELECT tenant_id,legal_entity_id,book_id,$1,line_key,account_code,role_code,transaction_debit,transaction_credit,functional_debit,functional_credit+CASE WHEN $3 AND functional_credit>0 THEN 0.01 ELSE 0 END,rounding_debit,rounding_credit,dimensions FROM finance_foundation_lines WHERE journal_id=$2',
      [id, originalId, corrupt],
    );
    await m.query(
      "INSERT INTO finance_foundation_journal_audits(tenant_id,legal_entity_id,book_id,journal_id,actor_subject_id,actor_natural_person_id,authority_id,subject_hash,reason) SELECT tenant_id,legal_entity_id,book_id,$1,actor_subject_id,actor_natural_person_id,authority_id,subject_hash,'Raw counterexample in disposable database only' FROM finance_foundation_journal_audits WHERE journal_id=$2",
      [id, originalId],
    );
  });
}
