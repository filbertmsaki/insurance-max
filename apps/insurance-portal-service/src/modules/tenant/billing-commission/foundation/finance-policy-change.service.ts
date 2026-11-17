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
} from './finance-configuration.types';
import {
  cashObject,
  cashText,
  type ObligationEvidence,
} from './finance-outgoing.types';
import {
  integrationBook,
  integrationScope,
  integrationSnapshot,
} from './finance-integration.controls';
import type { IntegrationScope } from './finance-integration.types';
import { verifyAcceptedSource } from './finance-accepted-source';
import {
  controlUuid,
  controlHash,
  controlAmount as decimal,
  controlUnits as units,
} from './finance-receivables.types';
import { FinanceQuotationBillingService } from './finance-quotation-billing.service';
import { FinanceReceivablesService } from './finance-receivables.service';
import { FinanceOutgoingService } from './finance-outgoing.service';
import {
  changeIssues,
  changeRef,
  changeVector,
  entitlementDifference,
  netPremiumDifference,
  normalizePolicyChange,
  normalizeRefundPlan,
  payableDifference,
  POLICY_CHANGE_EVENT,
  signedUnits,
  type ChangeRef,
  type PolicyChangeEvidence,
} from './finance-policy-change.types';
type Actor = FinanceConfigurationActor;
type Row = Record<string, any>;
type Permission =
  | 'OBSERVE_CHANGE'
  | 'REVIEW_CHANGE'
  | 'PREPARE_REFUND'
  | 'REVIEW_REFUND'
  | 'RECONCILE_REFUND'
  | 'READ_CHANGE';
const fail = (m: string): never => {
  throw new ConflictException(m);
};
/** Inactive evidence only. Never applies source policy changes, edits invoices or executes cash. */
@Injectable()
export class FinancePolicyChangeService {
  private readonly billing: FinanceQuotationBillingService;
  private readonly receivables: FinanceReceivablesService;
  private readonly outgoing: FinanceOutgoingService;
  constructor(@InjectDataSource() private readonly source: DataSource) {
    this.billing = new FinanceQuotationBillingService(source);
    this.receivables = new FinanceReceivablesService(source);
    this.outgoing = new FinanceOutgoingService(source, []);
  }
  private ids(p: Actor, s: IntegrationScope) {
    return [p.tenantId, s.legalEntityId, s.bookId];
  }
  private identity(actor: Actor): Actor {
    if (actor?.kind !== 'USER')
      throw new ForbiddenException(
        'A trusted Finance policy-change identity is required.',
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
      "SELECT * FROM finance_policy_change_authorities WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND subject_id=$4 AND natural_person_id=$5 AND permission=$6 AND currency=$7 AND max_amount>=$8::numeric AND state='ENABLED' AND revoked_at IS NULL AND valid_from<=statement_timestamp() AND valid_to>statement_timestamp() FOR SHARE",
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
        'A unique current scoped policy-change/refund authority is required.',
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
          'Policy-change authority changed before completion.',
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
      'INSERT INTO finance_policy_change_audits(tenant_id,legal_entity_id,book_id,object_table,object_id,action,subject_hash,actor_subject_id,actor_natural_person_id,reason) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
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
        'The exact policy-change/refund reference is unavailable in this book.',
      );
    if (
      hash(row.subject) !== row.subject_hash ||
      canonicalFinanceJson(row.subject) !== row.canonical_subject
    )
      fail('Stored policy-change/refund content hash differs.');
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
  private async verifyChange(
    m: EntityManager,
    p: Actor,
    s: IntegrationScope,
    row: Row,
  ) {
    const snap = normalizePolicyChange(row.subject.snapshot);
    await verifyAcceptedSource(m, p, s, row.inbox_id, {
      eventType: POLICY_CHANGE_EVENT,
      factKind: 'POLICY_CHANGE',
      aggregateType: 'POLICY_CHANGE',
      aggregateId: snap.id,
      companyId: snap.sourceCompanyId,
      revision: snap.sourceRevision,
      snapshotHash: row.subject.rawSnapshotHash,
    });
    return snap;
  }
  private async policy(
    m: EntityManager,
    p: Actor,
    s: IntegrationScope,
    policyId: string,
  ) {
    const rows: Row[] = await m.query(
      'SELECT c.*,d.decision FROM finance_policy_changes c LEFT JOIN finance_policy_change_decisions d ON d.change_id=c.id WHERE c.tenant_id=$1 AND c.legal_entity_id=$2 AND c.book_id=$3 AND c.policy_id=$4 ORDER BY c.target_version_number,c.source_revision',
      [...this.ids(p, s), policyId],
    );
    const reviewed = rows.filter((c) => c.decision === 'REVIEWED_INACTIVE'),
      head = reviewed.at(-1) ?? null;
    const [aliases] = await m.query(
      "SELECT count(*)::int n FROM finance_policy_change_aliases a JOIN finance_policy_changes c ON c.id=a.change_id WHERE c.tenant_id=$1 AND c.policy_id=$2 AND a.state='CONFLICT_HELD'",
      [p.tenantId, policyId],
    );
    const latest = new Map<string, Row>();
    for (const row of rows) latest.set(row.source_transaction_id, row);
    const pending = [...latest.values()].some(
      (c) => c.decision !== 'REVIEWED_INACTIVE',
    );
    return { rows, reviewed, head, pending, conflicts: aliases.n };
  }
  async observe(
    actor: Actor,
    scope: IntegrationScope,
    input: { inboxId: string; snapshot: unknown },
    reason: string,
  ) {
    const raw = cashObject(input.snapshot),
      snap = normalizePolicyChange(raw);
    return this.command(
      actor,
      scope,
      'OBSERVE_CHANGE',
      snap.currency,
      '0',
      reason,
      async (m, p, s, g) => {
        const accepted = await verifyAcceptedSource(
          m,
          p,
          s,
          controlUuid(input.inboxId),
          {
            eventType: POLICY_CHANGE_EVENT,
            factKind: 'POLICY_CHANGE',
            aggregateType: 'POLICY_CHANGE',
            aggregateId: snap.id,
            companyId: snap.sourceCompanyId,
            revision: snap.sourceRevision,
            snapshotHash: hash(raw),
          },
        );
        const billing = await this.billing.verifiedReference(
          m,
          p,
          s,
          snap.originalBilling.id,
          snap.originalBilling.hash,
          false,
        );
        if (
          billing.source_company_id !== snap.sourceCompanyId ||
          billing.currency !== snap.currency ||
          billing.decimal_scale !== snap.decimalScale ||
          billing.subject.snapshot.customerId !== snap.customerId ||
          billing.subject.snapshot.quotationId !== snap.quotationId ||
          (billing.subject.snapshot.policyId &&
            billing.subject.snapshot.policyId !== snap.policyId)
        )
          fail(
            'Policy change differs from its original customer, quotation, currency or billing ownership.',
          );
        const [owner] = await m.query(
          'SELECT book_id,legal_entity_id FROM finance_policy_changes WHERE tenant_id=$1 AND source_company_id=$2 AND policy_id=$3 LIMIT 1',
          [p.tenantId, snap.sourceCompanyId, snap.policyId],
        );
        if (
          owner &&
          (owner.book_id !== s.bookId ||
            owner.legal_entity_id !== s.legalEntityId)
        )
          throw new ForbiddenException(
            'The policy economic identity belongs to another Finance book.',
          );
        const [alias] = await m.query(
          'SELECT * FROM finance_policy_change_aliases WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND inbox_id=$4',
          [...this.ids(p, s), input.inboxId],
        );
        if (alias) {
          if (alias.subject.rawSnapshotHash !== hash(raw))
            fail('An accepted inbox cannot change its policy evidence.');
          const row = await this.row(m, p, s, 'finance_policy_changes', {
            id: alias.change_id,
            hash: alias.subject.changeHash,
          });
          return {
            ...this.result(row, true),
            sourceState: alias.state,
            issues: changeIssues(snap),
          };
        }
        const previous: Row[] = await m.query(
          'SELECT c.*,d.decision FROM finance_policy_changes c LEFT JOIN finance_policy_change_decisions d ON d.change_id=c.id WHERE c.tenant_id=$1 AND c.source_company_id=$2 AND c.source_transaction_id=$3 ORDER BY c.source_revision DESC',
          [p.tenantId, snap.sourceCompanyId, snap.id],
        );
        const old = previous[0],
          vectorHash = hash(changeVector(snap));
        let row = old,
          state = 'MATCHED';
        if (
          old &&
          old.vector_hash !== vectorHash &&
          previous.some((c) => c.decision === 'REVIEWED_INACTIVE')
        )
          state = 'CONFLICT_HELD';
        else if (!old || old.vector_hash !== vectorHash) {
          if (old && snap.sourceRevision <= old.source_revision)
            fail(
              'A changed unreviewed source requires its next signed source revision.',
            );
          const id = randomUUID(),
            correction = snap.correctionOf
              ? await this.row(
                  m,
                  p,
                  s,
                  'finance_policy_changes',
                  snap.correctionOf,
                )
              : null;
          if (
            correction &&
            (correction.policy_id !== snap.policyId ||
              correction.currency !== snap.currency)
          )
            fail('Corrections must retain original policy and currency.');
          row = {
            id,
            ...this.scope(p, s),
            source_company_id: snap.sourceCompanyId,
            source_transaction_id: snap.id,
            policy_id: snap.policyId,
            source_revision: snap.sourceRevision,
            economic_root: accepted.economic_root,
            vector_hash: vectorHash,
            currency: snap.currency,
            decimal_scale: snap.decimalScale,
            source_version_id: snap.sourceVersion.id,
            source_version_number: snap.sourceVersion.number,
            target_version_id: snap.targetVersion.id,
            target_version_number: snap.targetVersion.number,
            original_billing_id: snap.originalBilling.id,
            previous_id: snap.previousChange?.id ?? null,
            correction_of_id: correction?.id ?? null,
            entitlement_root_id:
              correction?.entitlement_root_id ?? old?.entitlement_root_id ?? id,
            entitlement_delta: decimal(entitlementDifference(snap)),
            inbox_id: input.inboxId,
            ...this.content({
              schema: 'FINANCE_POLICY_CHANGE_RECORD_V1',
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
            'finance_policy_changes',
            row,
            'OBSERVE_APPLIED_CHANGE',
            reason,
          );
        }
        const link = {
          id: randomUUID(),
          ...this.scope(p, s),
          change_id: row.id,
          inbox_id: input.inboxId,
          state,
          source_revision: snap.sourceRevision,
          ...this.content({
            changeHash: row.subject_hash,
            rawSnapshotHash: hash(raw),
            incomingSnapshot: snap,
            state,
          }),
          ...this.actor(p, g),
        };
        await this.insert(
          m,
          p,
          s,
          'finance_policy_change_aliases',
          link,
          state,
          reason,
        );
        return {
          ...this.result(row, Boolean(old)),
          sourceState: state,
          issues: changeIssues(snap),
        };
      },
    );
  }
  async reviewChange(
    actor: Actor,
    scope: IntegrationScope,
    ref: ChangeRef,
    decision: 'REVIEWED_INACTIVE' | 'REJECTED_INACTIVE',
    reason: string,
  ) {
    if (!['REVIEWED_INACTIVE', 'REJECTED_INACTIVE'].includes(decision))
      throw new BadRequestException(
        'Only inactive change review is supported.',
      );
    const selected = await this.selected(
      actor,
      scope,
      'finance_policy_changes',
      ref,
    );
    return this.command(
      actor,
      scope,
      'REVIEW_CHANGE',
      selected.currency,
      '0',
      reason,
      async (m, p, s, g) => {
        const row = await this.row(m, p, s, 'finance_policy_changes', ref),
          snap = await this.verifyChange(m, p, s, row);
        if (
          row.actor_subject_id === p.subjectId ||
          row.actor_natural_person_id === p.naturalPersonId
        )
          throw new ForbiddenException(
            'Independent policy-change review excludes maker aliases.',
          );
        const [old] = await m.query(
          'SELECT * FROM finance_policy_change_decisions WHERE change_id=$1',
          [row.id],
        );
        if (old) {
          if (old.decision !== decision || old.actor_subject_id !== p.subjectId)
            fail('This policy-change review is already frozen.');
          return this.result(old, true);
        }
        if (decision === 'REVIEWED_INACTIVE') {
          const position = await this.policy(m, p, s, row.policy_id),
            latest = position.rows
              .filter(
                (c) => c.source_transaction_id === row.source_transaction_id,
              )
              .at(-1);
          if (latest?.id !== row.id || position.conflicts)
            fail('The latest unconflicted policy source is required.');
          if (changeIssues(snap).length)
            fail(
              'Source tax/component breakdown or invoice reconciliation remains unresolved.',
            );
          const head = position.head;
          if (
            (head?.id ?? null) !== (snap.previousChange?.id ?? null) ||
            (head && head.subject_hash !== snap.previousChange?.hash) ||
            (head &&
              (head.target_version_id !== snap.sourceVersion.id ||
                head.target_version_number !== snap.sourceVersion.number))
          )
            fail(
              'Policy term changed, has a missing predecessor or is out of order.',
            );
          if (
            head?.subject.snapshot.kind === 'CANCELLATION' &&
            snap.effect === 'NORMAL'
          )
            fail(
              'A cancelled term needs an explicit evidenced correction, not another ordinary change.',
            );
          if (snap.correctionOf) {
            const original = await this.row(
                m,
                p,
                s,
                'finance_policy_changes',
                snap.correctionOf,
              ),
              accepted = position.reviewed.find((c) => c.id === original.id),
              rootHead = position.reviewed
                .filter(
                  (c) => c.entitlement_root_id === original.entitlement_root_id,
                )
                .at(-1);
            if (!accepted || rootHead?.id !== original.id)
              fail(
                'A correction must reference the latest accepted original control effect.',
              );
            const originalSnap = await this.verifyChange(m, p, s, original);
            if (
              snap.effect === 'REVERSAL' &&
              (payableDifference(snap) !== -payableDifference(originalSnap) ||
                ['taxDifference', 'feeDifference', 'commissionDifference'].some(
                  (k) =>
                    snap[k] === null ||
                    originalSnap[k] === null ||
                    signedUnits(snap[k]) !== -signedUnits(originalSnap[k]),
                ) ||
                snap.taxLines?.length !== originalSnap.taxLines?.length ||
                snap.taxLines?.some(
                  (line) =>
                    !originalSnap.taxLines?.some(
                      (original) =>
                        original.code === line.code &&
                        original.kind === line.kind &&
                        original.ruleHash === line.ruleHash &&
                        signedUnits(line.amount) ===
                          -signedUnits(original.amount),
                    ),
                ))
            )
              fail(
                'A full reversal must invert the exact original component vector.',
              );
          }
        }
        const decisionRow = {
          id: randomUUID(),
          ...this.scope(p, s),
          change_id: row.id,
          decision,
          ...this.content({
            changeHash: row.subject_hash,
            decision,
            authorityHash: hash(integrationSnapshot(g)),
          }),
          ...this.actor(p, g),
        };
        await this.insert(
          m,
          p,
          s,
          'finance_policy_change_decisions',
          decisionRow,
          decision,
          reason,
        );
        return this.result(decisionRow);
      },
    );
  }
  private async rootPosition(
    m: EntityManager,
    p: Actor,
    s: IntegrationScope,
    change: Row,
  ) {
    const policy = await this.policy(m, p, s, change.policy_id),
      rootRows = policy.reviewed.filter(
        (c) => c.entitlement_root_id === change.entitlement_root_id,
      ),
      entitlement = rootRows.reduce(
        (n, c) => n + signedUnits(c.entitlement_delta),
        0n,
      );
    const requests: Row[] = await m.query(
      "SELECT r.*,EXISTS(SELECT 1 FROM finance_policy_refund_events WHERE refund_id=r.id AND action IN ('REJECT','CANCEL')) released FROM finance_policy_refund_requests r WHERE r.tenant_id=$1 AND r.legal_entity_id=$2 AND r.book_id=$3 AND r.entitlement_root_id=$4",
      [...this.ids(p, s), change.entitlement_root_id],
    );
    const reserved = requests
      .filter((r) => !r.released)
      .reduce((n, r) => n + units(r.amount), 0n);
    return {
      ...policy,
      entitlement,
      reserved,
      available: entitlement - reserved,
      requests,
    };
  }
  private async refundEvents(m: EntityManager, refund: Row) {
    return m.query(
      'SELECT * FROM finance_policy_refund_events WHERE refund_id=$1 ORDER BY created_at,id',
      [refund.id],
    );
  }
  private async refundCurrent(
    m: EntityManager,
    p: Actor,
    s: IntegrationScope,
    refund: Row,
    approved = true,
  ) {
    const change = await this.row(m, p, s, 'finance_policy_changes', {
        id: refund.change_id,
        hash: refund.subject.plan.change.hash,
      }),
      position = await this.rootPosition(m, p, s, change),
      events = await this.refundEvents(m, refund),
      review = events.find((e) => e.action === 'APPROVE');
    for (const reviewed of position.reviewed)
      await this.verifyChange(m, p, s, reviewed);
    if (
      position.pending ||
      position.conflicts ||
      position.available < 0n ||
      position.head?.subject_hash !== refund.subject.policyHeadHash ||
      events.some((e) => ['REJECT', 'CANCEL'].includes(e.action))
    )
      fail(
        'Refund source is stale, conflicted, cancelled or below consumed entitlement.',
      );
    const [time] = await m.query('SELECT statement_timestamp() now');
    if (new Date(refund.expires_at) <= time.now)
      fail('Refund approval expired.');
    const assignment = await this.receivables.verifiedAssignment(
      m,
      p,
      s,
      refund.subject.plan.assignment,
    );
    if (
      assignment.sourceConflicts ||
      assignment.billingLineageHolds ||
      signedUnits(assignment.remainingAfterReversals) <
        signedUnits(assignment.refundReserved)
    )
      fail('Original allocation is conflicted or already consumed.');
    if (approved) {
      if (!review)
        throw new ConflictException(
          'An independently approved refund is required.',
        );
      const [authority] = await m.query(
        "SELECT * FROM finance_policy_change_authorities WHERE id=$1 AND state='ENABLED' AND revoked_at IS NULL AND valid_from<=statement_timestamp() AND valid_to>statement_timestamp() FOR SHARE",
        [review.authority_id],
      );
      if (
        !authority ||
        hash(integrationSnapshot(authority)) !== review.subject.authorityHash
      )
        throw new ForbiddenException(
          'Frozen refund approval authority changed or expired.',
        );
    }
    return { change, position, events, assignment };
  }
  async prepareRefund(
    actor: Actor,
    scope: IntegrationScope,
    value: unknown,
    reason: string,
  ) {
    const raw: any = cashObject(value),
      selected = await this.selected(
        actor,
        scope,
        'finance_policy_changes',
        changeRef(raw.change),
      ),
      plan = normalizeRefundPlan(raw, selected.decimal_scale);
    return this.command(
      actor,
      scope,
      'PREPARE_REFUND',
      selected.currency,
      plan.amount,
      reason,
      async (m, p, s, g) => {
        const [retry] = await m.query(
          'SELECT * FROM finance_policy_refund_requests WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND command_key=$4',
          [...this.ids(p, s), plan.commandKey],
        );
        if (retry) {
          if (
            hash(retry.subject.plan) !== hash(plan) ||
            retry.actor_subject_id !== p.subjectId
          )
            fail('The refund command key has different frozen content.');
          await this.row(m, p, s, 'finance_policy_refund_requests', {
            id: retry.id,
            hash: retry.subject_hash,
          });
          return this.result(retry, true);
        }
        const change = await this.row(
            m,
            p,
            s,
            'finance_policy_changes',
            plan.change,
          ),
          position = await this.rootPosition(m, p, s, change),
          assignment = await this.receivables.verifiedAssignment(
            m,
            p,
            s,
            plan.assignment,
          ),
          snap = change.subject.snapshot;
        if (
          !position.reviewed.some((c) => c.id === change.id) ||
          position.pending ||
          position.conflicts ||
          !position.head ||
          position.available < units(plan.amount)
        )
          fail(
            'Current reviewed return-premium entitlement is insufficient or held.',
          );
        if (
          assignment.assignment.memo_id !== change.original_billing_id ||
          assignment.receipt.customer_id !== snap.customerId ||
          assignment.receipt.source_company_id !== snap.sourceCompanyId ||
          assignment.receipt.currency !== change.currency ||
          assignment.receipt.decimal_scale !== change.decimal_scale ||
          assignment.sourceConflicts ||
          assignment.billingLineageHolds ||
          signedUnits(assignment.remainingAfterReversals) -
            signedUnits(assignment.refundReserved) <
            units(plan.amount)
        )
          fail(
            'Refund exceeds the exact original receipt assignment or differs in ownership/currency.',
          );
        const [time] = await m.query('SELECT statement_timestamp() now');
        if (
          Date.parse(plan.expiresAt) <= time.now.getTime() ||
          Date.parse(plan.expiresAt) > new Date(g.valid_to).getTime()
        )
          fail(
            'Refund expiry must be future and bounded by its preparer authority.',
          );
        const subject = {
          schema: 'FINANCE_POLICY_REFUND_V1',
          purpose: 'INACTIVE_CONTROLS_ONLY',
          plan,
          policyHeadHash: position.head!.subject_hash,
          sourceCompanyId: snap.sourceCompanyId,
          customerId: snap.customerId,
          policyId: snap.policyId,
          authorityHash: hash(integrationSnapshot(g)),
          accountingState: 'HELD_INACTIVE',
          financialEffects: 0,
        };
        const [old] = await m.query(
          'SELECT * FROM finance_policy_refund_requests WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND command_key=$4',
          [...this.ids(p, s), plan.commandKey],
        );
        if (old) {
          if (old.subject_hash !== hash(subject))
            fail('The refund command key has different frozen content.');
          return this.result(old, true);
        }
        const row = {
          id: randomUUID(),
          ...this.scope(p, s),
          command_key: plan.commandKey,
          change_id: change.id,
          entitlement_root_id: change.entitlement_root_id,
          assignment_id: assignment.assignment.id,
          amount: plan.amount,
          currency: change.currency,
          decimal_scale: change.decimal_scale,
          beneficiary_hash: hash(plan.beneficiary),
          expires_at: new Date(plan.expiresAt),
          ...this.content(subject),
          ...this.actor(p, g),
        };
        await this.insert(
          m,
          p,
          s,
          'finance_policy_refund_requests',
          row,
          'PREPARE_REFUND',
          reason,
        );
        return this.result(row);
      },
    );
  }
  private async refundEvent(
    m: EntityManager,
    p: Actor,
    s: IntegrationScope,
    g: Row,
    refund: Row,
    action: string,
    key: string,
    reason: string,
    details: Row = {},
    intentId: string | null = null,
  ) {
    cashText(key, 150);
    const subject = {
      refundHash: refund.subject_hash,
      action,
      commandKey: key,
      details,
      authorityHash: hash(integrationSnapshot(g)),
      financialEffects: 0,
      legalDischargeAccepted: false,
    };
    const [old] = await m.query(
      'SELECT * FROM finance_policy_refund_events WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND command_key=$4',
      [...this.ids(p, s), key],
    );
    if (old) {
      if (old.subject_hash !== hash(subject))
        fail('A refund command key cannot change its event.');
      return this.result(old, true);
    }
    const row = {
      id: randomUUID(),
      ...this.scope(p, s),
      refund_id: refund.id,
      action,
      command_key: key,
      outgoing_intent_id: intentId,
      ...this.content(subject),
      ...this.actor(p, g),
    };
    await this.insert(
      m,
      p,
      s,
      'finance_policy_refund_events',
      row,
      action,
      reason,
    );
    return this.result(row);
  }
  async reviewRefund(
    actor: Actor,
    scope: IntegrationScope,
    ref: ChangeRef,
    action: 'APPROVE' | 'REJECT' | 'CANCEL',
    key: string,
    reason: string,
  ) {
    if (!['APPROVE', 'REJECT', 'CANCEL'].includes(action))
      throw new BadRequestException('Unsupported refund review.');
    const selected = await this.selected(
      actor,
      scope,
      'finance_policy_refund_requests',
      ref,
    );
    return this.command(
      actor,
      scope,
      'REVIEW_REFUND',
      selected.currency,
      selected.amount,
      reason,
      async (m, p, s, g) => {
        const refund = await this.row(
          m,
          p,
          s,
          'finance_policy_refund_requests',
          ref,
        );
        if (
          refund.actor_subject_id === p.subjectId ||
          refund.actor_natural_person_id === p.naturalPersonId ||
          refund.subject.plan.beneficiary.naturalPersonIds.includes(
            p.naturalPersonId,
          )
        )
          throw new ForbiddenException(
            'Independent refund review excludes preparer aliases and beneficiary-related people.',
          );
        if (action === 'APPROVE') {
          await this.refundCurrent(m, p, s, refund, false);
          if (new Date(refund.expires_at) > new Date(g.valid_to))
            fail('Reviewer authority must cover the refund expiry.');
        }
        if (action === 'CANCEL') {
          for (const event of (await this.refundEvents(m, refund)).filter(
            (e) => e.action === 'BIND_EXECUTION',
          )) {
            const payment = await this.outgoing.verifiedReference(
              m,
              p,
              s,
              event.subject.details.intent,
            );
            if (!['CANCELLED', 'FAILED_FINAL'].includes(payment.position.state))
              fail(
                'Refund capacity cannot be released while cash is active, unknown or confirmed.',
              );
          }
        }
        return this.refundEvent(m, p, s, g, refund, action, key, reason);
      },
    );
  }
  async obligationCandidate(
    actor: Actor,
    scope: IntegrationScope,
    ref: ChangeRef,
    fundingRef: ChangeRef,
    reason: string,
  ) {
    const selected = await this.selected(
      actor,
      scope,
      'finance_policy_refund_requests',
      ref,
    );
    return this.command(
      actor,
      scope,
      'PREPARE_REFUND',
      selected.currency,
      selected.amount,
      reason,
      async (m, p, s) => {
        const refund = await this.row(
          m,
          p,
          s,
          'finance_policy_refund_requests',
          ref,
        );
        await this.refundCurrent(m, p, s, refund);
        const [fund] = await m.query(
          "SELECT * FROM finance_outgoing_evidence WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND id=$4 AND subject_hash=$5 AND kind='FUNDING'",
          [
            ...this.ids(p, s),
            controlUuid(fundingRef.id),
            controlHash(fundingRef.hash),
          ],
        );
        if (
          !fund ||
          hash(fund.subject) !== fund.subject_hash ||
          fund.source_company_id !== refund.subject.sourceCompanyId ||
          fund.currency !== refund.currency ||
          fund.decimal_scale !== refund.decimal_scale
        )
          fail('Refund funding must retain its exact company and currency.');
        const snapshot: ObligationEvidence = {
          schema: 'FINANCE_OUTGOING_EVIDENCE_V1',
          kind: 'OBLIGATION',
          id: refund.id,
          sourceRevision: 1,
          sourceCompanyId: refund.subject.sourceCompanyId,
          sourceAccountId: fund.source_account_id,
          currency: refund.currency,
          decimalScale: refund.decimal_scale,
          obligationId: refund.id,
          amount: refund.amount,
          beneficiary: refund.subject.plan.beneficiary,
          entitlementEvidenceHash: refund.subject_hash,
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
      'finance_policy_refund_requests',
      ref,
    );
    return this.command(
      actor,
      scope,
      'PREPARE_REFUND',
      selected.currency,
      selected.amount,
      reason,
      async (m, p, s, g) => {
        const refund = await this.row(
          m,
          p,
          s,
          'finance_policy_refund_requests',
          ref,
        );
        const [retry] = await m.query(
          'SELECT * FROM finance_policy_refund_events WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND command_key=$4',
          [...this.ids(p, s), key],
        );
        if (retry) {
          if (
            retry.refund_id !== refund.id ||
            retry.action !== 'BIND_EXECUTION' ||
            hash(retry.subject.details.intent) !==
              hash(changeRef({ id: intent.id, hash: intent.hash })) ||
            retry.actor_subject_id !== p.subjectId
          )
            fail('The execution binding key has different content.');
          return this.result(retry, true);
        }
        const current = await this.refundCurrent(m, p, s, refund),
          payment = await this.outgoing.verifiedReference(m, p, s, intent),
          i = payment.intent,
          o = payment.obligation.subject.snapshot;
        if (
          !['APPROVED', 'RESERVED'].includes(payment.position.state) ||
          payment.position.calls.length ||
          o.obligationId !== refund.id ||
          o.entitlementEvidenceHash !== refund.subject_hash ||
          o.sourceCompanyId !== refund.subject.sourceCompanyId ||
          i.currency !== refund.currency ||
          i.decimal_scale !== refund.decimal_scale ||
          i.beneficiary_hash !== refund.beneficiary_hash ||
          new Date(i.expires_at) > new Date(refund.expires_at)
        )
          fail(
            'The exact approved, unexecuted refund cash intent and beneficiary are required.',
          );
        let bound = 0n;
        for (const link of current.events.filter(
          (e) => e.action === 'BIND_EXECUTION',
        )) {
          const existing = await this.outgoing.verifiedReference(
            m,
            p,
            s,
            link.subject.details.intent,
          );
          if (!['CANCELLED', 'FAILED_FINAL'].includes(existing.position.state))
            bound += units(existing.intent.amount);
        }
        if (bound + units(i.amount) > units(refund.amount))
          fail('Bound cash executions exceed the approved refund.');
        return this.refundEvent(
          m,
          p,
          s,
          g,
          refund,
          'BIND_EXECUTION',
          key,
          reason,
          { intent: changeRef({ id: intent.id, hash: intent.hash }) },
          i.id,
        );
      },
    );
  }
  async reconcileRefund(
    actor: Actor,
    scope: IntegrationScope,
    ref: ChangeRef,
    key: string,
    reason: string,
  ) {
    const selected = await this.selected(
      actor,
      scope,
      'finance_policy_refund_requests',
      ref,
    );
    return this.command(
      actor,
      scope,
      'RECONCILE_REFUND',
      selected.currency,
      selected.amount,
      reason,
      async (m, p, s, g) => {
        const refund = await this.row(
          m,
          p,
          s,
          'finance_policy_refund_requests',
          ref,
        );
        if (
          refund.actor_natural_person_id === p.naturalPersonId ||
          refund.subject.plan.beneficiary.naturalPersonIds.includes(
            p.naturalPersonId,
          )
        )
          throw new ForbiddenException(
            'Independent refund cash reconciliation is required.',
          );
        let principal = 0n,
          fees = 0n,
          uncertain = false,
          exception = false,
          bankMatched = true;
        const executions: Row[] = [];
        for (const event of (await this.refundEvents(m, refund)).filter(
          (e) => e.action === 'BIND_EXECUTION',
        )) {
          const payment = await this.outgoing.verifiedReference(
              m,
              p,
              s,
              event.subject.details.intent,
            ),
            seen = new Set<string>();
          for (const observation of payment.position.observations.filter(
            (o) => o.state === 'CONFIRMED',
          ))
            if (!seen.has(observation.provider_payment_id)) {
              seen.add(observation.provider_payment_id);
              principal += units(observation.amount);
              fees += units(observation.fee);
            }
          if (payment.position.paid > 0n && !payment.bankReconciled)
            bankMatched = false;
          exception ||= payment.position.exception;
          uncertain ||= ['UNKNOWN', 'PENDING'].includes(payment.position.state);
          executions.push({
            intent: event.subject.details.intent,
            state: payment.position.state,
            bankReconciled: payment.bankReconciled,
          });
        }
        const change = await this.row(
            m,
            p,
            s,
            'finance_policy_changes',
            refund.subject.plan.change,
          ),
          position = await this.rootPosition(m, p, s, change);
        exception ||=
          position.available < 0n ||
          position.conflicts > 0 ||
          principal > units(refund.amount);
        const state = exception
          ? 'EXCEPTION_HELD'
          : principal > 0n && !bankMatched
            ? 'UNRECONCILED_CASH_HELD'
            : principal === units(refund.amount)
              ? 'CONFIRMED_CASH_HELD'
              : principal > 0n
                ? 'PARTIALLY_CONFIRMED_CASH_HELD'
                : uncertain
                  ? 'OUTCOME_UNKNOWN_HELD'
                  : 'NO_CONFIRMED_REFUND';
        return {
          ...(await this.refundEvent(
            m,
            p,
            s,
            g,
            refund,
            'RECONCILE_CASH',
            key,
            reason,
            {
              state,
              principal: decimal(principal),
              fees: decimal(fees),
              executions,
              entitlementAvailable: decimal(position.available),
            },
          )),
          state,
          principal: decimal(principal),
          fees: decimal(fees),
          legalDischargeAccepted: false,
        };
      },
    );
  }
  /** Transaction-local B17 reference. An inactive review never authorises a journal. */
  async verifiedCommissionChange(
    m: EntityManager,
    p: Actor,
    s: IntegrationScope,
    ref: ChangeRef,
  ) {
    const row = await this.row(m, p, s, 'finance_policy_changes', ref);
    const snap = await this.verifyChange(m, p, s, row);
    const pos = await this.rootPosition(m, p, s, row);
    const [decision] = await m.query(
      "SELECT 1 FROM finance_policy_change_decisions WHERE change_id=$1 AND decision='REVIEWED_INACTIVE'",
      [row.id],
    );
    if (
      !decision ||
      pos.pending ||
      pos.conflicts ||
      !pos.head ||
      pos.head.id !== row.id ||
      changeIssues(snap).length
    )
      fail(
        'A current independently reviewed policy-change commission vector is required.',
      );
    return snap;
  }
  async readChange(actor: Actor, scope: IntegrationScope, ref: ChangeRef) {
    const selected = await this.selected(
      actor,
      scope,
      'finance_policy_changes',
      ref,
    );
    return this.command(
      actor,
      scope,
      'READ_CHANGE',
      selected.currency,
      '0',
      'Read held policy-change position',
      async (m, p, s) => {
        const row = await this.row(m, p, s, 'finance_policy_changes', ref),
          snap = await this.verifyChange(m, p, s, row),
          pos = await this.rootPosition(m, p, s, row);
        return {
          ...this.result(row),
          kind: snap.kind,
          effect: snap.effect,
          payableDifference: decimal(payableDifference(snap)),
          netPremiumDifference: netPremiumDifference(snap),
          taxDifference: snap.taxDifference,
          feeDifference: snap.feeDifference,
          commissionDifference: snap.commissionDifference,
          entitlement: decimal(pos.entitlement),
          refundReserved: decimal(pos.reserved),
          entitlementAvailable: decimal(pos.available),
          policyHead: pos.head
            ? { id: pos.head.id, hash: pos.head.subject_hash }
            : null,
          holds: [
            ...changeIssues(snap),
            ...(pos.pending ? ['APPLIED_SOURCE_CHANGE_PENDING_REVIEW'] : []),
            ...(pos.conflicts ? ['SOURCE_CONFLICT_HELD'] : []),
            ...(pos.available < 0n
              ? ['ENTITLEMENT_BELOW_CONSUMED_REFUNDS']
              : []),
            'UNRESOLVED_ACCOUNTING_POLICIES',
            'LEGACY_FINANCIAL_EFFECTS_NOT_RECONCILED',
          ],
          sourceFinancialWrites: 0,
        };
      },
    );
  }
}
