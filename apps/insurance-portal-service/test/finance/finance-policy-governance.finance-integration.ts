import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { ProductDefinitionHashService } from '@insurance-max/shared-kernel';
import { FinancePolicyGovernance1797100000000 } from '../../src/database/migrations/1797100000000-FinancePolicyGovernance';
import { FinancePolicyService } from '../../src/modules/tenant/billing-commission/foundation/finance-policy.service';
import {
  FinancePolicyDefinition,
  FinancePolicyActor,
} from '../../src/modules/tenant/billing-commission/foundation/finance-policy.types';
import { FinanceLegalEntity } from '../../src/modules/tenant/billing-commission/foundation/entities/finance-legal-entity.entity';
import { FinanceAccountingBook } from '../../src/modules/tenant/billing-commission/foundation/entities/finance-accounting-book.entity';
import { FinancePostingPolicyService } from '../../src/modules/tenant/billing-commission/services/finance-posting-policy.service';
import { ProviderWebhookService } from '../../src/modules/tenant/billing-commission/services/provider-webhook.service';
import { FinanceProviderEvent } from '../../src/modules/tenant/billing-commission/entities/finance-provider-event.entity';
import { FinanceAccount } from '../../src/modules/tenant/billing-commission/entities/finance-account.entity';
import { FinanceJournalEntry } from '../../src/modules/tenant/billing-commission/entities/finance-journal-entry.entity';
import { FinanceJournalLine } from '../../src/modules/tenant/billing-commission/entities/finance-journal-line.entity';
import { withFinanceTestDatabase } from '../support/finance-test-database';

const evidence = 'a'.repeat(64);
const definition = (): FinancePolicyDefinition => ({
  schema: 'FINANCE_POLICY_V1',
  policyCode: 'AP-01.01',
  version: 1,
  profile: 'INSURER',
  description: 'Synthetic policy',
  treatment: 'Test lifecycle only; no company treatment is authorized.',
  accountingLayer: 'CONTROL',
  effectiveFrom: '2026-11-16',
  effectiveTo: null,
  configuration: {},
  decisionReferences: [],
  unresolvedDecisions: [],
  dependencyPolicyHashes: [],
  evidenceReferences: ['SYNTHETIC-NOT-A-REAL-APPROVAL'],
});
async function db<T>(
  run: (f: Awaited<ReturnType<typeof fixture>>) => Promise<T>,
) {
  return withFinanceTestDatabase(
    async ({ dataSource: s }) => {
      const q = s.createQueryRunner();
      try {
        await new FinancePolicyGovernance1797100000000().up(q);
      } finally {
        await q.release();
      }
      return run(await fixture(s));
    },
    process.env,
    'scope-foundations',
  );
}
async function fixture(s: DataSource) {
  const tenantId = randomUUID(),
    entity = await s.getRepository(FinanceLegalEntity).save({
      tenant_id: tenantId,
      entity_code: 'TEST',
      legal_name: 'Synthetic policy entity',
      business_profile: 'GENERAL_INSURER',
    }),
    book = await s.getRepository(FinanceAccountingBook).save({
      tenant_id: tenantId,
      legal_entity_id: entity.id,
      book_code: 'TEST',
    });
  const scope = { tenantId, legalEntityId: entity.id, bookId: book.id },
    maker = { subjectId: randomUUID(), naturalPersonId: randomUUID() },
    checker = { subjectId: randomUUID(), naturalPersonId: randomUUID() },
    alias = { subjectId: randomUUID(), naturalPersonId: maker.naturalPersonId };
  async function grant(actor: FinancePolicyActor, capability: string) {
    await s.query(
      "INSERT INTO finance_policy_authorities(tenant_id,legal_entity_id,book_id,subject_id,natural_person_id,company_role,capability,authority_reference,valid_from) VALUES($1,$2,$3,$4,$5,'COMPANY_ADMIN',$6,'SYNTHETIC-ONLY','2020-01-01')",
      [
        tenantId,
        entity.id,
        book.id,
        actor.subjectId,
        actor.naturalPersonId,
        capability,
      ],
    );
  }
  for (const actor of [maker, checker, alias])
    for (const capability of ['PREPARE', 'VALIDATE', 'APPROVE', 'ACTIVATE'])
      await grant(actor, capability);
  const service = new FinancePolicyService(s),
    prepare = (d = definition()) => service.prepare(scope, maker, d);
  const configure = async (d = definition()) => {
    const p = await prepare(d);
    await service.transition(
      scope,
      maker,
      p.id,
      p.definitionHash,
      'CONFIGURE',
      evidence,
      'Synthetic explicit configuration',
    );
    return p;
  };
  return { s, scope, maker, checker, alias, service, prepare, configure };
}
describe('Policy resolution on owned PostgreSQL; no development data or actual grants', () => {
  it('PG01 creates empty registries and reverses only an unused migration', async () => {
    await withFinanceTestDatabase(
      async ({ dataSource: s }) => {
        const q = s.createQueryRunner(),
          m = new FinancePolicyGovernance1797100000000();
        try {
          await m.up(q);
          expect(
            (
              await s.query(
                'SELECT count(*)::integer n FROM finance_policy_versions',
              )
            )[0].n,
          ).toBe(0);
          await m.down(q);
          expect(
            (
              await s.query("SELECT to_regclass('finance_policy_versions') t")
            )[0].t,
          ).toBeNull();
        } finally {
          await q.release();
        }
      },
      process.env,
      'scope-foundations',
    );
  });
  it('PG02 requires independent validation and explicit admin approval', () =>
    db(async (f) => {
      const p = await f.configure();
      await f.service.transition(
        f.scope,
        f.checker,
        p.id,
        p.definitionHash,
        'VALIDATE',
        evidence,
        'Synthetic independent validation',
      );
      expect(
        (
          await f.s.query(
            'SELECT to_state FROM finance_policy_events WHERE policy_id=$1 ORDER BY sequence DESC LIMIT 1',
            [p.id],
          )
        )[0].to_state,
      ).toBe('VALIDATED');
      expect(
        await f.service.transition(
          f.scope,
          f.checker,
          p.id,
          p.definitionHash,
          'APPROVE',
          evidence,
          'Synthetic explicit approval',
        ),
      ).toMatchObject({ state: 'APPROVED', financialEffects: 0 });
      await expect(
        f.service.transition(
          f.scope,
          f.checker,
          p.id,
          p.definitionHash,
          'ACTIVATE',
          evidence,
          'No deployment release exists',
        ),
      ).rejects.toThrow('B43-B45');
      expect(
        (await f.s.query("SELECT to_regclass('finance_journal_entries') t"))[0]
          .t,
      ).toBeNull();
    }));
  it('PG03 denies the maker and another login for the same natural person', () =>
    db(async (f) => {
      const p = await f.configure();
      for (const actor of [
        f.maker,
        f.alias,
        {
          subjectId: f.alias.subjectId.toUpperCase(),
          naturalPersonId: f.alias.naturalPersonId.toUpperCase(),
        },
      ])
        await expect(
          f.service.transition(
            f.scope,
            actor,
            p.id,
            p.definitionHash,
            'VALIDATE',
            evidence,
            'Self approval is unavailable',
          ),
        ).rejects.toThrow('preparer');
      expect(
        (
          await f.s.query(
            'SELECT count(*)::integer n FROM finance_policy_events WHERE policy_id=$1',
            [p.id],
          )
        )[0].n,
      ).toBe(1);
    }));
  it('PG04 keeps unresolved decisions blocked and requires a new content version', () =>
    db(async (f) => {
      const p = await f.configure({
        ...definition(),
        unresolvedDecisions: ['DEC-06'],
      });
      await expect(
        f.service.transition(
          f.scope,
          f.checker,
          p.id,
          p.definitionHash,
          'VALIDATE',
          evidence,
          'Tax treatment is missing',
        ),
      ).rejects.toThrow('unresolved');
      expect(
        await f.service.transition(
          f.scope,
          f.maker,
          p.id,
          p.definitionHash,
          'BLOCK',
          evidence,
          'Company admin must decide tax scope',
        ),
      ).toMatchObject({ state: 'BLOCKED_PENDING_APPROVAL' });
      await expect(
        f.service.transition(
          f.scope,
          f.maker,
          p.id,
          p.definitionHash,
          'CONFIGURE',
          evidence,
          'Cannot alter frozen content',
        ),
      ).rejects.toThrow();
    }));
  it('PG05 denies cross-tenant access, stale hashes and expired mandates', () =>
    db(async (f) => {
      const p = await f.configure();
      await expect(
        f.service.transition(
          { ...f.scope, tenantId: randomUUID() },
          f.checker,
          p.id,
          p.definitionHash,
          'VALIDATE',
          evidence,
          'Wrong company',
        ),
      ).rejects.toThrow();
      await expect(
        f.service.transition(
          f.scope,
          f.checker,
          p.id,
          'b'.repeat(64),
          'VALIDATE',
          evidence,
          'Wrong content',
        ),
      ).rejects.toThrow();
      await f.s.query(
        'UPDATE finance_policy_authorities SET revoked_at=statement_timestamp() WHERE subject_id=$1',
        [f.checker.subjectId],
      );
      await expect(
        f.service.transition(
          f.scope,
          f.checker,
          p.id,
          p.definitionHash,
          'VALIDATE',
          evidence,
          'Revoked admin mandate',
        ),
      ).rejects.toThrow();
    }));
  it('PG06 preserves append-only definitions, event evidence and used migrations', () =>
    db(async (f) => {
      const p = await f.configure();
      await expect(
        f.s.query(
          "UPDATE finance_policy_versions SET definition='{}' WHERE id=$1",
          [p.id],
        ),
      ).rejects.toThrow('append-only');
      await expect(
        f.s.query('DELETE FROM finance_policy_events WHERE policy_id=$1', [
          p.id,
        ]),
      ).rejects.toThrow('append-only');
      const q = f.s.createQueryRunner();
      try {
        await expect(
          new FinancePolicyGovernance1797100000000().down(q),
        ).rejects.toThrow('rollback');
      } finally {
        await q.release();
      }
    }));
  it('PG07 does not equate a retired policy or passing tests with activation', () =>
    db(async (f) => {
      const p = await f.configure();
      await expect(
        f.service.transition(
          f.scope,
          f.checker,
          p.id,
          p.definitionHash,
          'RETIRE',
          evidence,
          '',
        ),
      ).rejects.toThrow();
      expect(
        await f.service.transition(
          f.scope,
          f.checker,
          p.id,
          p.definitionHash,
          'RETIRE',
          evidence,
          'Superseded test policy; new version required',
        ),
      ).toMatchObject({ state: 'RETIRED' });
      await expect(
        f.service.transition(
          f.scope,
          f.checker,
          p.id,
          p.definitionHash,
          'ACTIVATE',
          evidence,
          'Tests passed',
        ),
      ).rejects.toThrow();
    }));
  it('PG08 holds live posting without governance and leaves legacy journals empty', () =>
    withFinanceTestDatabase(async ({ dataSource: s }) => {
      await expect(
        new FinancePostingPolicyService().requireEligible(s.manager, {
          companyId: randomUUID(),
          sourceType: 'INVOICE',
          currency: 'TZS',
          date: '2026-11-16',
          accountMappings: [],
        }),
      ).rejects.toMatchObject({ response: { code: 'FINANCE_POSTING_HELD' } });
      expect(await s.getRepository(FinanceJournalEntry).count()).toBe(0);
    }));
  it('PG11 exercises the deployed eligibility query and denies draft books', () =>
    db(async (f) => {
      await expect(
        f.s.transaction((manager) =>
          new FinancePostingPolicyService().requireEligible(manager, {
            companyId: randomUUID(),
            sourceType: 'INVOICE',
            currency: 'TZS',
            date: '2026-11-16',
            accountMappings: [],
          }),
        ),
      ).rejects.toMatchObject({ response: { code: 'FINANCE_POSTING_HELD' } });
    }));
  it('PG12 database constraints reject a direct lifecycle skip', () =>
    db(async (f) => {
      const p = await f.prepare();
      const [a] = await f.s.query(
        "SELECT id FROM finance_policy_authorities WHERE subject_id=$1 AND capability='APPROVE'",
        [f.checker.subjectId],
      );
      await expect(
        f.s.query(
          "INSERT INTO finance_policy_events(tenant_id,legal_entity_id,book_id,policy_id,sequence,from_state,to_state,action,actor_subject_id,actor_natural_person_id,authority_id,reason,evidence_hash,previous_hash,event_hash) VALUES($1,$2,$3,$4,1,'DRAFT','APPROVED','APPROVE',$5,$6,$7,'Synthetic attempt',$8,$9,$8)",
          [
            f.scope.tenantId,
            f.scope.legalEntityId,
            f.scope.bookId,
            p.id,
            f.checker.subjectId,
            f.checker.naturalPersonId,
            a.id,
            evidence,
            p.definitionHash,
          ],
        ),
      ).rejects.toThrow('lifecycle');
    }));
  it('PG13 database constraints independently deny maker self-validation', () =>
    db(async (f) => {
      const p = await f.configure(),
        [last] = await f.s.query(
          'SELECT event_hash FROM finance_policy_events WHERE policy_id=$1',
          [p.id],
        ),
        [a] = await f.s.query(
          "SELECT id FROM finance_policy_authorities WHERE subject_id=$1 AND capability='VALIDATE'",
          [f.maker.subjectId],
        );
      await expect(
        f.s.query(
          "INSERT INTO finance_policy_events(tenant_id,legal_entity_id,book_id,policy_id,sequence,from_state,to_state,action,actor_subject_id,actor_natural_person_id,authority_id,reason,evidence_hash,previous_hash,event_hash) VALUES($1,$2,$3,$4,2,'CONFIGURED','VALIDATED','VALIDATE',$5,$6,$7,'Synthetic self approval',$8,$9,$8)",
          [
            f.scope.tenantId,
            f.scope.legalEntityId,
            f.scope.bookId,
            p.id,
            f.maker.subjectId,
            f.maker.naturalPersonId,
            a.id,
            evidence,
            last.event_hash,
          ],
        ),
      ).rejects.toThrow('Independent');
    }));
  it('PG14 serializes concurrent policy decisions against the same version', () =>
    db(async (f) => {
      const p = await f.configure(),
        results = await Promise.allSettled(
          [1, 2].map(() =>
            f.service.transition(
              f.scope,
              f.checker,
              p.id,
              p.definitionHash,
              'VALIDATE',
              evidence,
              'Synthetic concurrent validation',
            ),
          ),
        );
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
      expect(
        (
          await f.s.query(
            'SELECT count(*)::integer n FROM finance_policy_events WHERE policy_id=$1',
            [p.id],
          )
        )[0].n,
      ).toBe(2);
    }));
  it('PG15 permits mandated staff preparation while reserving approval for company admin', () =>
    db(async (f) => {
      const staff = { subjectId: randomUUID(), naturalPersonId: randomUUID() },
        args = [
          f.scope.tenantId,
          f.scope.legalEntityId,
          f.scope.bookId,
          staff.subjectId,
          staff.naturalPersonId,
        ];
      await f.s.query(
        "INSERT INTO finance_policy_authorities(tenant_id,legal_entity_id,book_id,subject_id,natural_person_id,company_role,capability,authority_reference,valid_from) VALUES($1,$2,$3,$4,$5,'FINANCE_POLICY_PREPARER','PREPARE','SYNTHETIC-STAFF','2020-01-01')",
        args,
      );
      const p = await f.service.prepare(f.scope, staff, definition());
      await f.service.transition(
        f.scope,
        staff,
        p.id,
        p.definitionHash,
        'CONFIGURE',
        evidence,
        'Synthetic authorized staff configuration',
      );
      await f.service.transition(
        f.scope,
        f.checker,
        p.id,
        p.definitionHash,
        'VALIDATE',
        evidence,
        'Synthetic independent validation',
      );
      await expect(
        f.service.transition(
          f.scope,
          staff,
          p.id,
          p.definitionHash,
          'APPROVE',
          evidence,
          'Staff cannot approve',
        ),
      ).rejects.toThrow('mandate');
      await expect(
        f.s.query(
          "INSERT INTO finance_policy_authorities(tenant_id,legal_entity_id,book_id,subject_id,natural_person_id,company_role,capability,authority_reference,valid_from) VALUES($1,$2,$3,$4,$5,'FINANCE_POLICY_PREPARER','APPROVE','INVALID-STAFF','2020-01-01')",
          args,
        ),
      ).rejects.toThrow();
      expect(
        await f.service.transition(
          f.scope,
          f.checker,
          p.id,
          p.definitionHash,
          'APPROVE',
          evidence,
          'Synthetic company-admin decision',
        ),
      ).toMatchObject({ state: 'APPROVED', financialEffects: 0 });
    }));
  it('PG16 prevents mandate mutation and unrevocation', () =>
    db(async (f) => {
      await expect(
        f.s.query(
          'UPDATE finance_policy_authorities SET natural_person_id=$1 WHERE subject_id=$2',
          [randomUUID(), f.maker.subjectId],
        ),
      ).rejects.toThrow('immutable');
      await f.s.query(
        'UPDATE finance_policy_authorities SET revoked_at=statement_timestamp() WHERE subject_id=$1',
        [f.maker.subjectId],
      );
      await expect(
        f.s.query(
          'UPDATE finance_policy_authorities SET revoked_at=NULL WHERE subject_id=$1',
          [f.maker.subjectId],
        ),
      ).rejects.toThrow('immutable');
      await expect(f.prepare()).rejects.toThrow('mandate');
    }));
});

async function providerDb<T>(
  run: (f: {
    s: DataSource;
    service: ProviderWebhookService;
    apply: jest.Mock;
  }) => Promise<T>,
) {
  return withFinanceTestDatabase(async ({ dataSource }) => {
    const s = new DataSource({
      ...dataSource.options,
      entities: [
        FinanceAccount,
        FinanceJournalEntry,
        FinanceJournalLine,
        FinanceProviderEvent,
      ],
      migrations: [],
      migrationsRun: false,
      synchronize: true,
    });
    await s.initialize();
    try {
      await s.query(
        'CREATE TABLE policy_test_cash(id uuid PRIMARY KEY, company_id uuid NOT NULL, status text NOT NULL)',
      );
      await s.query(
        'CREATE TABLE policy_test_partial_accounting(id uuid PRIMARY KEY)',
      );
      const payment = {
        id: randomUUID(),
        company_id: randomUUID(),
        status: 'SUCCESSFUL',
      };
      const event = {
        providerCode: 'SYNTHETIC',
        eventId: 'synthetic-event',
        eventType: 'payment.success',
        rawPayload: { amount: '100' },
        status: 'SUCCESSFUL',
      };
      const apply = jest.fn(async (manager) => {
        await manager.query('INSERT INTO policy_test_cash VALUES($1,$2,$3)', [
          payment.id,
          payment.company_id,
          payment.status,
        ]);
        return payment;
      });
      const service = new ProviderWebhookService(
        s,
        {
          require: () => ({
            verifySignature: async () => true,
            parseEvent: async () => event,
          }),
        } as never,
        new ProductDefinitionHashService(),
        { redactPaymentPayload: (p: unknown) => p } as never,
        { applyProviderEvent: apply } as never,
        {
          postWhenEligible: async (manager: any) => {
            await manager.query(
              'INSERT INTO policy_test_partial_accounting VALUES($1)',
              [randomUUID()],
            );
            await manager.query('SELECT 1/0');
          },
        } as never,
      );
      return await run({ s, service, apply });
    } finally {
      await s.destroy();
    }
  });
}
describe('Confirmed provider cash survives accounting holds on real PostgreSQL', () => {
  it('PG09 commits confirmed cash and an explicit exception after rolling back failed accounting', () =>
    providerDb(async (f) => {
      expect(
        await f.service.process('SYNTHETIC', {}, Buffer.from('{}')),
      ).toMatchObject({ accepted: true, accountingHeld: true });
      expect(
        (await f.s.query('SELECT status FROM policy_test_cash'))[0].status,
      ).toBe('SUCCESSFUL');
      expect(
        (
          await f.s.query(
            'SELECT count(*)::integer n FROM policy_test_partial_accounting',
          )
        )[0].n,
      ).toBe(0);
      expect(
        await f.s
          .getRepository(FinanceProviderEvent)
          .findOneByOrFail({ provider_event_id: 'synthetic-event' }),
      ).toMatchObject({
        status: 'PROCESSED',
        processing_error: expect.stringContaining('ACCOUNTING_HELD'),
      });
    }));
  it('PG10 serializes duplicate callbacks without reapplying cash or accounting', () =>
    providerDb(async (f) => {
      const results = await Promise.all([
        f.service.process('SYNTHETIC', {}, Buffer.from('{}')),
        f.service.process('SYNTHETIC', {}, Buffer.from('{}')),
      ]);
      expect(f.apply).toHaveBeenCalledTimes(1);
      expect(results.filter((r) => r.duplicate)).toHaveLength(1);
      expect(results.every((r) => r.accountingHeld)).toBe(true);
      expect(
        (await f.s.query('SELECT count(*)::integer n FROM policy_test_cash'))[0]
          .n,
      ).toBe(1);
    }));
});
