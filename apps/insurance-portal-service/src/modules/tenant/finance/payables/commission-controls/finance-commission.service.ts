import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import {
  canonicalFinanceJson,
  financeConfigurationHash as hash,
  type FinanceConfigurationActor,
} from '../../foundation/finance-configuration/finance-configuration.types';
import {
  cashObject,
  cashText,
  cashAmount,
  type ObligationEvidence,
} from '../outgoing-payments/finance-outgoing.types';
import {
  normalizeBeneficiary,
  approvalFields as validateFields,
} from '../../governance/finance-approvals/finance-approval.types';
import {
  integrationBook,
  integrationScope,
  integrationSnapshot,
} from '../../integrations/finance-events/finance-integration.controls';
import type { IntegrationScope } from '../../integrations/finance-events/finance-integration.types';
import { verifyAcceptedSource } from '../../integrations/source-evidence/finance-accepted-source';
import {
  controlUuid,
  controlCurrency,
  controlHash,
  controlAmount as decimal,
  controlUnits as units,
} from '../../receivables/receivable-controls/finance-receivables.types';
import { FinanceQuotationBillingService } from '../../integrations/quotation-finance/finance-quotation-billing.service';
import { FinanceOutgoingService } from '../outgoing-payments/finance-outgoing.service';
import { FinancePolicyChangeService } from '../../governance/accounting-policies/finance-policy-change.service';
import {
  changeRef,
  signedUnits,
  type ChangeRef,
} from '../../governance/accounting-policies/finance-policy-change.types';
import {
  COMMISSION_EVENT,
  normalizeCommission,
  commissionIssues,
  commissionVector,
  type CommissionEvidence,
} from './finance-commission.types';
import { policyPricingHashMatches } from '../../taxation/tax-calculation/endorsement-invoice-tax';
type Actor = FinanceConfigurationActor;
const approvalFields = (v: unknown, keys: string[]): void =>
  validateFields(v, keys);
type Row = Record<string, any>;
type Permission =
  | 'OBSERVE_COMMISSION'
  | 'REVIEW_COMMISSION'
  | 'PREPARE_SETTLEMENT'
  | 'REVIEW_SETTLEMENT'
  | 'RECONCILE_COMMISSION'
  | 'READ_COMMISSION';
const fail = (m: string): never => {
  throw new ConflictException(m);
};
/** Inactive evidence only. Never applies source policy changes, edits invoices or executes cash. */
@Injectable()
export class FinanceCommissionService {
  private readonly billing: FinanceQuotationBillingService;
  private readonly outgoing: FinanceOutgoingService;
  constructor(@InjectDataSource() private readonly source: DataSource) {
    this.billing = new FinanceQuotationBillingService(source);
    this.outgoing = new FinanceOutgoingService(source, []);
  }
  private ids(p: Actor, s: IntegrationScope) {
    return [p.tenantId, s.legalEntityId, s.bookId];
  }
  private identity(actor: Actor): Actor {
    if (actor?.kind !== 'USER')
      throw new ForbiddenException(
        'A trusted Finance commission identity is required.',
      );
    return Object.freeze({
      kind: 'USER',
      tenantId: controlUuid(actor.tenantId),
      subjectId: controlUuid(actor.subjectId),
      naturalPersonId: controlUuid(actor.naturalPersonId),
    });
  }
  private async grant(
    m: EntityManager,
    p: Actor,
    s: IntegrationScope,
    permission: Permission,
    currency: string,
    value = '0',
  ) {
    const rows = await m.query(
      "SELECT * FROM finance_commission_authorities WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND subject_id=$4 AND natural_person_id=$5 AND permission=$6 AND currency=$7 AND max_amount>=$8::numeric AND state='ENABLED' AND revoked_at IS NULL AND valid_from<=statement_timestamp() AND valid_to>statement_timestamp() FOR SHARE",
      [
        ...this.ids(p, s),
        p.subjectId,
        p.naturalPersonId,
        permission,
        currency,
        value,
      ],
    );
    if (rows.length !== 1)
      throw new ForbiddenException(
        'A unique current scoped commission authority is required.',
      );
    return rows[0] as Row;
  }
  private async command<T>(
    actor: Actor,
    scope: IntegrationScope,
    permission: Permission,
    currency: string,
    value: string,
    reason: string,
    run: (
      m: EntityManager,
      p: Actor,
      s: IntegrationScope,
      g: Row,
    ) => Promise<T>,
  ): Promise<T> {
    const p = this.identity(actor),
      s = integrationScope(scope);
    cashText(reason, 2000);
    return this.source.transaction(async (m) => {
      await m.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        'finance-inactive-config:' + p.tenantId,
      ]);
      await integrationBook(
        m,
        { kind: 'WORKER', tenantId: p.tenantId, subjectId: p.subjectId },
        s,
      );
      const g = await this.grant(m, p, s, permission, currency, value),
        result = await run(m, p, s, g),
        current = await this.grant(m, p, s, permission, currency, value);
      if (hash(integrationSnapshot(g)) !== hash(integrationSnapshot(current)))
        throw new ForbiddenException(
          'commission authority changed before completion.',
        );
      return result;
    });
  }
  private scope(p: Actor, s: IntegrationScope) {
    return {
      tenant_id: p.tenantId,
      legal_entity_id: s.legalEntityId,
      book_id: s.bookId,
    };
  }
  private actor(p: Actor, g: Row) {
    return {
      actor_subject_id: p.subjectId,
      actor_natural_person_id: p.naturalPersonId,
      authority_id: g.id,
    };
  }
  private content(subject: Row) {
    return {
      subject,
      canonical_subject: canonicalFinanceJson(subject),
      subject_hash: hash(subject),
    };
  }
  private async insert(
    m: EntityManager,
    p: Actor,
    s: IntegrationScope,
    table: string,
    row: Row,
    action: string,
    reason: string,
  ) {
    const keys = Object.keys(row);
    await m.query(
      `INSERT INTO ${table}(${keys.join(',')}) VALUES(${keys.map((_, i) => '$' + (i + 1)).join(',')})`,
      Object.values(row),
    );
    await m.query(
      'INSERT INTO finance_commission_audits(tenant_id,legal_entity_id,book_id,object_table,object_id,action,subject_hash,actor_subject_id,actor_natural_person_id,reason) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
      [
        ...this.ids(p, s),
        table,
        row.id,
        action,
        row.subject_hash,
        p.subjectId,
        p.naturalPersonId,
        reason,
      ],
    );
  }
  private result(r: Row, reused = false) {
    return {
      id: r.id,
      hash: r.subject_hash,
      reused,
      accountingState: 'HELD_INACTIVE',
      dischargeState: 'LEGAL_DISCHARGE_HELD',
      financialEffects: 0,
    };
  }
  private async row(
    m: EntityManager,
    p: Actor,
    s: IntegrationScope,
    table: string,
    ref: ChangeRef,
  ) {
    const [row] = await m.query(
      `SELECT * FROM ${table} WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND id=$4 AND subject_hash=$5 FOR SHARE`,
      [...this.ids(p, s), controlUuid(ref.id), controlHash(ref.hash)],
    );
    if (!row)
      throw new ForbiddenException(
        'The exact commission reference is unavailable in this book.',
      );
    if (
      hash(row.subject) !== row.subject_hash ||
      canonicalFinanceJson(row.subject) !== row.canonical_subject
    )
      fail('Stored commission content hash differs.');
    return row as Row;
  }
  private async selected(
    actor: Actor,
    scope: IntegrationScope,
    table: string,
    ref: ChangeRef,
  ) {
    const p = this.identity(actor),
      s = integrationScope(scope);
    return this.source.transaction((m) =>
      this.row(m, p, s, table, changeRef({ id: ref.id, hash: ref.hash })),
    );
  }
  private async evidence(
    m: EntityManager,
    p: Actor,
    s: IntegrationScope,
    r: Row,
  ) {
    const snap = normalizeCommission(r.subject.snapshot);
    await verifyAcceptedSource(m, p, s, r.inbox_id, {
      eventType: COMMISSION_EVENT,
      factKind: 'COMMISSION',
      aggregateType: 'COMMISSION',
      aggregateId: snap.id,
      companyId: snap.sourceCompanyId,
      revision: snap.sourceRevision,
      snapshotHash: r.subject.rawSnapshotHash,
    });
    return snap;
  }
  private async maker(
    m: EntityManager,
    p: Actor,
    s: IntegrationScope,
    r: Row,
    permission: Permission,
    value = '0',
  ) {
    const grant = await this.grant(
      m,
      {
        ...p,
        subjectId: r.actor_subject_id,
        naturalPersonId: r.actor_natural_person_id,
      },
      s,
      permission,
      r.currency,
      value,
    );
    if (
      grant.id !== r.authority_id ||
      hash(integrationSnapshot(grant)) !== r.subject.authorityHash
    )
      fail('Frozen commission maker authority changed.');
  }
  private async position(
    m: EntityManager,
    p: Actor,
    s: IntegrationScope,
    root: string,
  ) {
    const rows: Row[] = await m.query(
      'SELECT c.*,d.decision FROM finance_commission_movements c LEFT JOIN finance_commission_reviews d ON d.movement_id=c.id WHERE c.tenant_id=$1 AND c.legal_entity_id=$2 AND c.book_id=$3 AND c.commission_id=$4 ORDER BY c.created_at,c.id',
      [...this.ids(p, s), root],
    );
    const accepted = rows.filter((r) => r.decision === 'REVIEWED_INACTIVE');
    for (const r of accepted) await this.evidence(m, p, s, r);
    // The chain, rather than timestamps, identifies its economic head.
    const head = accepted.find(
      (r) => !accepted.some((n) => n.previous_id === r.id),
    );
    const initial = accepted.find((r) => r.previous_id === null);
    const [{ source_pending }] = await m.query(
      'SELECT finance_commission_source_pending($1,$2) source_pending',
      [p.tenantId, root],
    );
    const pending =
      source_pending ||
      rows.some(
        (r) =>
          !r.decision &&
          !rows.some(
            (n) =>
              n.source_id === r.source_id &&
              n.source_revision > r.source_revision,
          ),
      );
    const [{ conflict }] = await m.query(
      "SELECT EXISTS(SELECT 1 FROM finance_commission_aliases a JOIN finance_commission_movements c ON c.id=a.movement_id WHERE c.tenant_id=$1 AND c.commission_id=$2 AND a.state='CONFLICT_HELD') conflict",
      [p.tenantId, root],
    );
    const [{ reserved }] = await m.query(
      "SELECT COALESCE(sum(amount),0)::text reserved FROM finance_commission_settlements r WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND commission_id=$4 AND NOT EXISTS(SELECT 1 FROM finance_commission_events e WHERE e.settlement_id=r.id AND e.action IN ('REJECT','CANCEL'))",
      [...this.ids(p, s), root],
    );
    const sum = (k: string) =>
      accepted.reduce((n, r) => n + signedUnits(r.subject.snapshot[k]), 0n);
    const payable = sum('payableDelta'),
      legacyPaid = initial ? units(initial.subject.snapshot.legacyPaid) : 0n,
      legacyReserved = initial
        ? units(initial.subject.snapshot.legacyReserved)
        : 0n;
    return {
      rows,
      accepted,
      head,
      initial,
      pending,
      conflict,
      commission: sum('commissionDelta'),
      tax: sum('taxDelta'),
      withholding: sum('withholdingDelta'),
      payable,
      legacyPaid,
      legacyReserved,
      reserved: units(reserved),
      available: payable - legacyPaid - legacyReserved - units(reserved),
    };
  }
  async observe(
    actor: Actor,
    scope: IntegrationScope,
    input: { inboxId: string; snapshot: unknown },
    reason: string,
  ) {
    const raw = cashObject(input.snapshot),
      snap = normalizeCommission(raw);
    if (
      !policyPricingHashMatches(
        snap.calculation.snapshot,
        snap.calculation.hash,
      )
    )
      throw new BadRequestException(
        'Native commission calculation hash differs.',
      );
    return this.command(
      actor,
      scope,
      'OBSERVE_COMMISSION',
      snap.currency,
      '0',
      reason,
      async (m, p, s, g) => {
        await verifyAcceptedSource(m, p, s, controlUuid(input.inboxId), {
          eventType: COMMISSION_EVENT,
          factKind: 'COMMISSION',
          aggregateType: 'COMMISSION',
          aggregateId: snap.id,
          companyId: snap.sourceCompanyId,
          revision: snap.sourceRevision,
          snapshotHash: hash(raw),
        });
        const bill = await this.billing.verifiedReference(
          m,
          p,
          s,
          snap.originalBilling.id,
          snap.originalBilling.hash,
          false,
        );
        if (
          bill.source_company_id !== snap.sourceCompanyId ||
          bill.currency !== snap.currency ||
          bill.decimal_scale !== snap.decimalScale ||
          bill.subject.snapshot.quotationId !== snap.quotationId ||
          (bill.subject.snapshot.policyId &&
            bill.subject.snapshot.policyId !== snap.policyId)
        )
          fail('Commission differs from original scoped billing.');
        const [owner] = await m.query(
          'SELECT * FROM finance_commission_movements WHERE tenant_id=$1 AND commission_id=$2 LIMIT 1',
          [p.tenantId, snap.commissionId],
        );
        if (
          owner &&
          (owner.book_id !== s.bookId ||
            owner.legal_entity_id !== s.legalEntityId ||
            owner.source_company_id !== snap.sourceCompanyId)
        )
          throw new ForbiddenException(
            'Commission economic identity belongs to another book or company.',
          );
        const [alias] = await m.query(
          'SELECT * FROM finance_commission_aliases WHERE inbox_id=$1 AND tenant_id=$2 AND book_id=$3',
          [input.inboxId, p.tenantId, s.bookId],
        );
        if (alias) {
          if (alias.subject.rawSnapshotHash !== hash(raw))
            fail('Accepted commission inbox content differs.');
          const r = await this.row(m, p, s, 'finance_commission_movements', {
            id: alias.movement_id,
            hash: alias.subject.movementHash,
          });
          return {
            ...this.result(r, true),
            sourceState: alias.state,
            issues: commissionIssues(snap),
          };
        }
        const prior: Row[] = await m.query(
          'SELECT c.*,d.decision FROM finance_commission_movements c LEFT JOIN finance_commission_reviews d ON d.movement_id=c.id WHERE c.tenant_id=$1 AND c.source_id=$2 ORDER BY c.source_revision DESC',
          [p.tenantId, snap.id],
        );
        const old = prior[0],
          vector = hash(commissionVector(snap));
        let row = old,
          state = 'MATCHED';
        if (
          old &&
          old.vector_hash !== vector &&
          prior.some((r) => r.decision === 'REVIEWED_INACTIVE')
        )
          state = 'CONFLICT_HELD';
        else if (!old || old.vector_hash !== vector) {
          if (
            old &&
            (snap.sourceRevision <= old.source_revision ||
              old.commission_id !== snap.commissionId)
          )
            fail(
              'Changed evidence needs a higher revision of the same commission.',
            );
          row = {
            id: randomUUID(),
            ...this.scope(p, s),
            source_company_id: snap.sourceCompanyId,
            source_id: snap.id,
            source_revision: snap.sourceRevision,
            commission_id: snap.commissionId,
            party_id: snap.partyId,
            currency: snap.currency,
            decimal_scale: snap.decimalScale,
            previous_id: snap.previous?.id ?? null,
            inbox_id: input.inboxId,
            vector_hash: vector,
            ...this.content({
              schema: 'FINANCE_COMMISSION_RECORD_V1',
              purpose: 'INACTIVE_CONTROLS_ONLY',
              snapshot: snap,
              rawSnapshotHash: hash(raw),
              authorityHash: hash(integrationSnapshot(g)),
            }),
            ...this.actor(p, g),
          };
          await this.insert(
            m,
            p,
            s,
            'finance_commission_movements',
            row,
            'OBSERVE_COMMISSION',
            reason,
          );
        }
        const link = {
          id: randomUUID(),
          ...this.scope(p, s),
          movement_id: row.id,
          inbox_id: input.inboxId,
          state,
          ...this.content({
            movementHash: row.subject_hash,
            rawSnapshotHash: hash(raw),
            incomingSnapshot: snap,
          }),
          ...this.actor(p, g),
        };
        await this.insert(
          m,
          p,
          s,
          'finance_commission_aliases',
          link,
          state,
          reason,
        );
        return {
          ...this.result(row, !!old),
          sourceState: state,
          issues: commissionIssues(snap),
        };
      },
    );
  }
  async review(
    actor: Actor,
    scope: IntegrationScope,
    ref: ChangeRef,
    decision: 'REVIEWED_INACTIVE' | 'REJECTED_INACTIVE',
    reason: string,
  ) {
    if (!['REVIEWED_INACTIVE', 'REJECTED_INACTIVE'].includes(decision))
      throw new BadRequestException(
        'Only inactive commission review is supported.',
      );
    const selected = await this.selected(
      actor,
      scope,
      'finance_commission_movements',
      ref,
    );
    const magnitude = [
      'commissionDelta',
      'taxDelta',
      'withholdingDelta',
      'payableDelta',
    ].reduce((maximum, k) => {
      const value = selected.subject.snapshot[k];
      if (value === null) return maximum;
      const signed = signedUnits(value),
        absolute = signed < 0n ? -signed : signed;
      return absolute > maximum ? absolute : maximum;
    }, 0n);
    return this.command(
      actor,
      scope,
      'REVIEW_COMMISSION',
      selected.currency,
      decimal(magnitude < 0n ? -magnitude : magnitude),
      reason,
      async (m, p, s, g) => {
        const r = await this.row(m, p, s, 'finance_commission_movements', ref),
          snap = await this.evidence(m, p, s, r);
        await this.maker(m, p, s, r, 'OBSERVE_COMMISSION');
        if (
          r.actor_subject_id === p.subjectId ||
          r.actor_natural_person_id === p.naturalPersonId ||
          (snap.beneficiary.mode === 'REFERENCED' &&
            snap.beneficiary.naturalPersonIds.includes(p.naturalPersonId))
        )
          throw new ForbiddenException(
            'Independent commission review is required.',
          );
        const [prior] = await m.query(
          'SELECT * FROM finance_commission_reviews WHERE movement_id=$1',
          [r.id],
        );
        if (prior) {
          if (
            prior.decision !== decision ||
            prior.actor_subject_id !== p.subjectId
          )
            fail('Commission review already differs.');
          return this.result(prior, true);
        }
        if (decision === 'REVIEWED_INACTIVE') {
          const pos = await this.position(m, p, s, snap.commissionId);
          if (
            pos.conflict ||
            pos.rows.some(
              (n) =>
                n.source_id === snap.id &&
                n.source_revision > snap.sourceRevision,
            )
          )
            fail('Current unconflicted commission evidence is required.');
          if (commissionIssues(snap).length)
            fail(
              'Commission tax and withholding breakdown remains unresolved.',
            );
          if (
            (pos.head?.id ?? null) !== (snap.previous?.id ?? null) ||
            (pos.head && pos.head.subject_hash !== snap.previous?.hash)
          )
            fail('Commission chain is stale or out of order.');
          if (pos.initial) {
            const first = pos.initial.subject.snapshot;
            for (const k of [
              'sourceCompanyId',
              'partyId',
              'quotationId',
              'policyId',
              'currency',
              'decimalScale',
              'legacyPaid',
              'legacyReserved',
              'legacyEvidenceHash',
            ])
              if (first[k] !== snap[k])
                fail(
                  'Commission party, currency and legacy settlement baseline must remain unchanged.',
                );
            if (
              hash(first.originalBilling) !== hash(snap.originalBilling) ||
              hash(first.beneficiary) !== hash(snap.beneficiary)
            )
              fail('Original billing and beneficiary must remain unchanged.');
          }
          if (snap.effect !== 'INITIAL') {
            const change = await new FinancePolicyChangeService(
              this.source,
            ).verifiedCommissionChange(m, p, s, snap.policyChange!);
            if (
              change.policyId !== snap.policyId ||
              change.sourceCompanyId !== snap.sourceCompanyId ||
              change.quotationId !== snap.quotationId ||
              change.currency !== snap.currency ||
              change.decimalScale !== snap.decimalScale ||
              hash(change.originalBilling) !== hash(snap.originalBilling) ||
              signedUnits(change.commissionDifference!) !==
                signedUnits(snap.commissionDelta)
            )
              fail('Applied policy-change commission delta differs.');
            const [used] = await m.query(
              "SELECT c.id FROM finance_commission_movements c JOIN finance_commission_reviews d ON d.movement_id=c.id AND d.decision='REVIEWED_INACTIVE' WHERE c.tenant_id=$1 AND c.commission_id=$2 AND c.subject->'snapshot'->'policyChange'->>'id'=$3",
              [p.tenantId, snap.commissionId, snap.policyChange!.id],
            );
            if (used)
              fail('Policy-change commission effect is already consumed.');
            if (snap.effect === 'REVERSAL') {
              const reversed = await this.row(
                m,
                p,
                s,
                'finance_commission_movements',
                snap.reverses!,
              );
              if (!pos.accepted.some((n) => n.id === reversed.id))
                fail(
                  'Reversal requires an accepted movement in this commission.',
                );
              for (const k of [
                'commissionDelta',
                'taxDelta',
                'withholdingDelta',
                'payableDelta',
              ])
                if (
                  signedUnits(snap[k]) !==
                  -signedUnits(reversed.subject.snapshot[k])
                )
                  fail('Reversal must exactly oppose each original component.');
              const [done] = await m.query(
                "SELECT c.id FROM finance_commission_movements c JOIN finance_commission_reviews d ON d.movement_id=c.id AND d.decision='REVIEWED_INACTIVE' WHERE c.tenant_id=$1 AND c.subject->'snapshot'->'reverses'->>'id'=$2",
                [p.tenantId, reversed.id],
              );
              if (done) fail('Commission movement is already reversed.');
            }
          }
          // Late negative corrections are evidence even when cash has already consumed entitlement.
        }
        const row = {
          id: randomUUID(),
          ...this.scope(p, s),
          movement_id: r.id,
          decision,
          ...this.content({ movementHash: r.subject_hash, decision }),
          ...this.actor(p, g),
        };
        await this.insert(
          m,
          p,
          s,
          'finance_commission_reviews',
          row,
          'REVIEW_COMMISSION',
          reason,
        );
        return this.result(row);
      },
    );
  }
  private async current(
    m: EntityManager,
    p: Actor,
    s: IntegrationScope,
    r: Row,
    approved = true,
  ) {
    const pos = await this.position(m, p, s, r.commission_id);
    const events: Row[] = await m.query(
      'SELECT * FROM finance_commission_events WHERE settlement_id=$1 ORDER BY created_at,id',
      [r.id],
    );
    const [{ eligible }] = await m.query(
      'SELECT finance_commission_eligible($1,$2) eligible',
      [r.id, approved],
    );
    if (
      !eligible ||
      pos.pending ||
      pos.conflict ||
      pos.available < 0n ||
      !pos.head ||
      pos.head.subject_hash !== r.subject.head.hash ||
      new Date(r.expires_at).getTime() <= Date.now() ||
      events.some((e) => ['REJECT', 'CANCEL'].includes(e.action)) ||
      (approved && !events.some((e) => e.action === 'APPROVE'))
    )
      fail(
        'Commission settlement is unapproved, expired, stale or exceeds entitlement.',
      );
    return { pos, events };
  }
  async prepareSettlement(
    actor: Actor,
    scope: IntegrationScope,
    input: unknown,
    reason: string,
  ) {
    const plan: any = cashObject(input);
    approvalFields(plan, [
      'commandKey',
      'head',
      'amount',
      'beneficiary',
      'expiresAt',
    ]);
    plan.commandKey = cashText(plan.commandKey, 160);
    plan.head = changeRef(plan.head);
    plan.beneficiary = normalizeBeneficiary(plan.beneficiary);
    const selected = await this.selected(
      actor,
      scope,
      'finance_commission_movements',
      plan.head,
    );
    plan.amount = cashAmount(plan.amount, selected.decimal_scale);
    if (
      units(plan.amount) <= 0n ||
      !Number.isFinite(Date.parse(plan.expiresAt)) ||
      Date.parse(plan.expiresAt) <= Date.now() ||
      Date.parse(plan.expiresAt) > Date.now() + 86400000
    )
      throw new BadRequestException(
        'Positive settlement and expiry within 24 hours required.',
      );
    plan.expiresAt = new Date(plan.expiresAt).toISOString();
    return this.command(
      actor,
      scope,
      'PREPARE_SETTLEMENT',
      selected.currency,
      plan.amount,
      reason,
      async (m, p, s, g) => {
        const [old] = await m.query(
          'SELECT * FROM finance_commission_settlements WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND command_key=$4',
          [...this.ids(p, s), plan.commandKey],
        );
        if (old) {
          if (
            hash(old.subject.plan) !== hash(plan) ||
            old.actor_subject_id !== p.subjectId
          )
            fail('Commission settlement command differs.');
          return this.result(old, true);
        }
        const r = await this.row(
            m,
            p,
            s,
            'finance_commission_movements',
            plan.head,
          ),
          pos = await this.position(m, p, s, r.commission_id);
        if (
          pos.pending ||
          pos.conflict ||
          pos.head?.id !== r.id ||
          units(plan.amount) > pos.available
        )
          fail('Current commission payable is insufficient or held.');
        if (hash(plan.beneficiary) !== hash(r.subject.snapshot.beneficiary))
          fail('Exact commission-party beneficiary is required.');
        const row = {
          id: randomUUID(),
          ...this.scope(p, s),
          commission_id: r.commission_id,
          head_id: r.id,
          command_key: plan.commandKey,
          amount: plan.amount,
          currency: r.currency,
          decimal_scale: r.decimal_scale,
          beneficiary_hash: hash(plan.beneficiary),
          expires_at: plan.expiresAt,
          ...this.content({
            schema: 'FINANCE_COMMISSION_SETTLEMENT_V1',
            purpose: 'INACTIVE_CONTROLS_ONLY',
            plan,
            head: plan.head,
            sourceCompanyId: r.source_company_id,
            authorityHash: hash(integrationSnapshot(g)),
          }),
          ...this.actor(p, g),
        };
        await this.insert(
          m,
          p,
          s,
          'finance_commission_settlements',
          row,
          'PREPARE_SETTLEMENT',
          reason,
        );
        return this.result(row);
      },
    );
  }
  private async event(
    m: EntityManager,
    p: Actor,
    s: IntegrationScope,
    g: Row,
    r: Row,
    action: string,
    key: string,
    reason: string,
    details: Row = {},
    intent: string | null = null,
  ) {
    key = cashText(key, 160);
    const subject = { settlementHash: r.subject_hash, action, details };
    const [old] = await m.query(
      'SELECT * FROM finance_commission_events WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND command_key=$4',
      [...this.ids(p, s), key],
    );
    if (old) {
      if (
        old.settlement_id !== r.id ||
        old.action !== action ||
        old.actor_subject_id !== p.subjectId ||
        hash(old.subject) !== hash(subject)
      )
        fail('Commission event command differs.');
      return this.result(old, true);
    }
    const row = {
      id: randomUUID(),
      ...this.scope(p, s),
      settlement_id: r.id,
      action,
      command_key: key,
      outgoing_intent_id: intent,
      ...this.content(subject),
      ...this.actor(p, g),
    };
    await this.insert(
      m,
      p,
      s,
      'finance_commission_events',
      row,
      action,
      reason,
    );
    return this.result(row);
  }
  async reviewSettlement(
    actor: Actor,
    scope: IntegrationScope,
    ref: ChangeRef,
    action: 'APPROVE' | 'REJECT' | 'CANCEL',
    key: string,
    reason: string,
  ) {
    if (!['APPROVE', 'REJECT', 'CANCEL'].includes(action))
      throw new BadRequestException(
        'Explicit commission settlement decision required.',
      );
    const selected = await this.selected(
      actor,
      scope,
      'finance_commission_settlements',
      ref,
    );
    return this.command(
      actor,
      scope,
      'REVIEW_SETTLEMENT',
      selected.currency,
      selected.amount,
      reason,
      async (m, p, s, g) => {
        const r = await this.row(
          m,
          p,
          s,
          'finance_commission_settlements',
          ref,
        );
        if (
          p.subjectId === r.actor_subject_id ||
          p.naturalPersonId === r.actor_natural_person_id ||
          r.subject.plan.beneficiary.naturalPersonIds.includes(
            p.naturalPersonId,
          )
        )
          throw new ForbiddenException(
            'Independent commission settlement checker is required.',
          );
        if (action === 'APPROVE') {
          await this.maker(m, p, s, r, 'PREPARE_SETTLEMENT', r.amount);
          await this.current(m, p, s, r, false);
          if (new Date(g.valid_to) < new Date(r.expires_at))
            fail('Checker authority must cover settlement lifetime.');
        }
        if (action !== 'APPROVE')
          for (const link of await m.query(
            "SELECT * FROM finance_commission_events WHERE settlement_id=$1 AND action='BIND_EXECUTION'",
            [r.id],
          )) {
            const cash = await this.outgoing.verifiedReference(
              m,
              p,
              s,
              link.subject.details.intent,
            );
            if (!['CANCELLED', 'FAILED_FINAL'].includes(cash.position.state))
              fail(
                'Active or confirmed commission cash cannot release capacity.',
              );
          }
        return this.event(m, p, s, g, r, action, key, reason);
      },
    );
  }
  async obligationCandidate(
    actor: Actor,
    scope: IntegrationScope,
    ref: ChangeRef,
    funding: ChangeRef,
    reason: string,
  ) {
    const selected = await this.selected(
      actor,
      scope,
      'finance_commission_settlements',
      ref,
    );
    return this.command(
      actor,
      scope,
      'PREPARE_SETTLEMENT',
      selected.currency,
      selected.amount,
      reason,
      async (m, p, s) => {
        const r = await this.row(
          m,
          p,
          s,
          'finance_commission_settlements',
          ref,
        );
        await this.current(m, p, s, r);
        const [fund] = await m.query(
          "SELECT * FROM finance_outgoing_evidence WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND id=$4 AND subject_hash=$5 AND kind='FUNDING'",
          [
            ...this.ids(p, s),
            controlUuid(funding.id),
            controlHash(funding.hash),
          ],
        );
        if (
          !fund ||
          hash(fund.subject) !== fund.subject_hash ||
          fund.source_company_id !== r.subject.sourceCompanyId ||
          fund.currency !== r.currency ||
          fund.decimal_scale !== r.decimal_scale
        )
          fail('Commission funding company, book and currency must agree.');
        const snapshot: ObligationEvidence = {
          schema: 'FINANCE_OUTGOING_EVIDENCE_V1',
          kind: 'OBLIGATION',
          id: r.id,
          sourceRevision: 1,
          sourceCompanyId: r.subject.sourceCompanyId,
          sourceAccountId: fund.source_account_id,
          currency: r.currency,
          decimalScale: r.decimal_scale,
          obligationId: r.id,
          amount: r.amount,
          beneficiary: r.subject.plan.beneficiary,
          entitlementEvidenceHash: r.subject_hash,
        };
        return {
          snapshot,
          requiresSignedB11Intake: true,
          financialEffects: 0,
          sourceWrites: 0,
        };
      },
    );
  }
  async bindExecution(
    actor: Actor,
    scope: IntegrationScope,
    ref: ChangeRef,
    intent: ChangeRef,
    key: string,
    reason: string,
  ) {
    const selected = await this.selected(
      actor,
      scope,
      'finance_commission_settlements',
      ref,
    );
    return this.command(
      actor,
      scope,
      'PREPARE_SETTLEMENT',
      selected.currency,
      selected.amount,
      reason,
      async (m, p, s, g) => {
        const r = await this.row(
            m,
            p,
            s,
            'finance_commission_settlements',
            ref,
          ),
          { events } = await this.current(m, p, s, r),
          cash = await this.outgoing.verifiedReference(m, p, s, intent),
          i = cash.intent,
          o = cash.obligation.subject.snapshot;
        if (
          !['APPROVED', 'RESERVED'].includes(cash.position.state) ||
          cash.position.calls.length ||
          o.obligationId !== r.id ||
          o.entitlementEvidenceHash !== r.subject_hash ||
          o.sourceCompanyId !== r.subject.sourceCompanyId ||
          i.currency !== r.currency ||
          i.decimal_scale !== r.decimal_scale ||
          i.beneficiary_hash !== r.beneficiary_hash ||
          new Date(i.expires_at) > new Date(r.expires_at)
        )
          fail('Exact approved unexecuted commission intent is required.');
        let bound = 0n;
        for (const link of events.filter(
          (e) => e.action === 'BIND_EXECUTION' && e.outgoing_intent_id !== i.id,
        )) {
          const old = await this.outgoing.verifiedReference(
            m,
            p,
            s,
            link.subject.details.intent,
          );
          if (!['CANCELLED', 'FAILED_FINAL'].includes(old.position.state))
            bound += units(old.intent.amount);
        }
        if (bound + units(i.amount) > units(r.amount))
          fail('Commission executions exceed the approved settlement.');
        return this.event(
          m,
          p,
          s,
          g,
          r,
          'BIND_EXECUTION',
          key,
          reason,
          { intent: changeRef({ id: intent.id, hash: intent.hash }) },
          i.id,
        );
      },
    );
  }
  async reconcileSettlement(
    actor: Actor,
    scope: IntegrationScope,
    ref: ChangeRef,
    key: string,
    reason: string,
  ) {
    const selected = await this.selected(
      actor,
      scope,
      'finance_commission_settlements',
      ref,
    );
    return this.command(
      actor,
      scope,
      'RECONCILE_COMMISSION',
      selected.currency,
      selected.amount,
      reason,
      async (m, p, s, g) => {
        const r = await this.row(
          m,
          p,
          s,
          'finance_commission_settlements',
          ref,
        );
        if (
          p.naturalPersonId === r.actor_natural_person_id ||
          r.subject.plan.beneficiary.naturalPersonIds.includes(
            p.naturalPersonId,
          )
        )
          throw new ForbiddenException(
            'Independent commission reconciliation is required.',
          );
        let principal = 0n,
          fees = 0n,
          uncertain = false,
          exception = false,
          bankMatched = true;
        const executions: Row[] = [],
          seen = new Set<string>();
        for (const link of await m.query(
          "SELECT * FROM finance_commission_events WHERE settlement_id=$1 AND action='BIND_EXECUTION'",
          [r.id],
        )) {
          const cash = await this.outgoing.verifiedReference(
            m,
            p,
            s,
            link.subject.details.intent,
          );
          for (const o of cash.position.observations.filter(
            (o) => o.state === 'CONFIRMED',
          )) {
            const identity =
              cash.intent.funding_id + '/' + o.provider_payment_id;
            if (!seen.has(identity)) {
              seen.add(identity);
              principal += units(o.amount);
              fees += units(o.fee);
            }
          }
          if (cash.position.paid > 0n && !cash.bankReconciled)
            bankMatched = false;
          exception ||= cash.position.exception;
          uncertain ||= ['UNKNOWN', 'PENDING'].includes(cash.position.state);
          executions.push({
            intent: link.subject.details.intent,
            state: cash.position.state,
            bankReconciled: cash.bankReconciled,
          });
        }
        const pos = await this.position(m, p, s, r.commission_id);
        exception ||=
          pos.available < 0n || pos.conflict || principal > units(r.amount);
        const state = exception
          ? 'EXCEPTION_HELD'
          : principal > 0n && !bankMatched
            ? 'UNRECONCILED_CASH_HELD'
            : principal === units(r.amount)
              ? 'CONFIRMED_CASH_HELD'
              : principal > 0n
                ? 'PARTIALLY_CONFIRMED_CASH_HELD'
                : uncertain
                  ? 'OUTCOME_UNKNOWN_HELD'
                  : 'NO_CONFIRMED_COMMISSION';
        const details = {
          state,
          principal: decimal(principal),
          fees: decimal(fees),
          executions,
          entitlementAvailable: decimal(pos.available),
        };
        return {
          ...(await this.event(
            m,
            p,
            s,
            g,
            r,
            'RECONCILE_CASH',
            key,
            reason,
            details,
          )),
          ...details,
          legalDischargeAccepted: false,
        };
      },
    );
  }
  async readParty(
    actor: Actor,
    scope: IntegrationScope,
    partyId: string,
    currency: string,
  ) {
    partyId = controlUuid(partyId);
    currency = controlCurrency(currency);
    return this.command(
      actor,
      scope,
      'READ_COMMISSION',
      currency,
      '0',
      'Read inactive party commission roll-forward',
      async (m, p, s) => {
        const roots: Row[] = await m.query(
          'SELECT DISTINCT commission_id FROM finance_commission_movements WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND party_id=$4 AND currency=$5',
          [...this.ids(p, s), partyId, currency],
        );
        const totals = {
          commission: 0n,
          tax: 0n,
          withholding: 0n,
          payable: 0n,
          legacyPaid: 0n,
          legacyReserved: 0n,
          reserved: 0n,
          available: 0n,
        };
        const commissions: Row[] = [];
        for (const root of roots) {
          const pos = await this.position(m, p, s, root.commission_id);
          if (pos.initial && pos.initial.party_id !== partyId) continue;
          for (const key of Object.keys(totals) as (keyof typeof totals)[])
            totals[key] += pos[key];
          commissions.push({
            commissionId: root.commission_id,
            head: pos.head
              ? { id: pos.head.id, hash: pos.head.subject_hash }
              : null,
            decimalScale: pos.initial?.decimal_scale ?? null,
            payable: decimal(pos.payable),
            available: decimal(pos.available),
            sourcePending: pos.pending,
            sourceConflict: pos.conflict,
          });
        }
        return {
          partyId,
          currency,
          basis: 'REVIEWED_INACTIVE_MOVEMENTS_ONLY',
          currencyTreatment: 'SOURCE_CURRENCY_ONLY_NO_FX',
          totals: Object.fromEntries(
            Object.entries(totals).map(([key, value]) => [key, decimal(value)]),
          ),
          commissions,
          accountingState: 'HELD_INACTIVE',
          acquisitionAccountingState: 'HELD_INACTIVE',
          financialEffects: 0,
          sourceFinancialWrites: 0,
        };
      },
    );
  }
  async read(actor: Actor, scope: IntegrationScope, ref: ChangeRef) {
    const selected = await this.selected(
      actor,
      scope,
      'finance_commission_movements',
      ref,
    );
    return this.command(
      actor,
      scope,
      'READ_COMMISSION',
      selected.currency,
      '0',
      'Read inactive commission roll-forward',
      async (m, p, s) => {
        const r = await this.row(m, p, s, 'finance_commission_movements', ref);
        await this.evidence(m, p, s, r);
        const pos = await this.position(m, p, s, r.commission_id);
        return {
          ...this.result(r),
          partyId: r.party_id,
          currency: r.currency,
          commission: decimal(pos.commission),
          tax: decimal(pos.tax),
          withholding: decimal(pos.withholding),
          payable: decimal(pos.payable),
          legacyPaid: decimal(pos.legacyPaid),
          legacyReserved: decimal(pos.legacyReserved),
          settlementReserved: decimal(pos.reserved),
          available: decimal(pos.available),
          head: pos.head
            ? { id: pos.head.id, hash: pos.head.subject_hash }
            : null,
          movements: pos.accepted.map((c) => ({
            id: c.id,
            hash: c.subject_hash,
            commissionDelta: c.subject.snapshot.commissionDelta,
            acquisition: c.subject.snapshot.acquisition,
          })),
          acquisitionAccountingState: 'HELD_INACTIVE',
          expenseRecognised: '0',
          assetRecognised: '0',
          ifrs17Movements: 0,
          holds: [
            ...commissionIssues(r.subject.snapshot),
            ...(pos.pending ? ['SOURCE_CHANGE_PENDING_REVIEW'] : []),
            ...(pos.conflict ? ['SOURCE_CONFLICT_HELD'] : []),
            ...(pos.available < 0n
              ? ['CLAWBACK_OR_OVERCOMMITMENT_RECONCILIATION_REQUIRED']
              : []),
            'UNRESOLVED_ACCOUNTING_POLICIES',
            'LEGACY_EFFECTS_NOT_RECONCILED',
          ],
          sourceFinancialWrites: 0,
        };
      },
    );
  }
}
