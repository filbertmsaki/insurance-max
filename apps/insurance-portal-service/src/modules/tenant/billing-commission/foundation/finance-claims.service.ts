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
  cashAmount,
  type ObligationEvidence,
} from './finance-outgoing.types';
import {
  normalizeBeneficiary,
  approvalFields as validateFields,
} from './finance-approval.types';
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
import { FinanceReceivablesService } from './finance-receivables.service';
import { FinanceOutgoingService } from './finance-outgoing.service';
import {
  changeRef,
  signedUnits,
  type ChangeRef,
} from './finance-policy-change.types';
import {
  CLAIMS_EVENT,
  normalizeClaims,
  claimsIssues,
  claimsVector,
  claimsReviewAmount,
  claimLimit,
  licComparison,
  type ClaimsEvidence,
  type CaseVector,
} from './finance-claims.types';
type Actor = FinanceConfigurationActor;
const approvalFields = (v: unknown, keys: string[]): void =>
  validateFields(v, keys);
type Row = Record<string, any>;
type Permission =
  | 'OBSERVE_CLAIM'
  | 'REVIEW_CLAIM'
  | 'PREPARE_SETTLEMENT'
  | 'REVIEW_SETTLEMENT'
  | 'RECONCILE_CLAIM'
  | 'READ_CLAIM'
  | 'PREPARE_RECOVERY'
  | 'REVIEW_RECOVERY';
const fail = (m: string): never => {
  throw new ConflictException(m);
};
/** Inactive evidence only. Never applies source policy changes, edits invoices or executes cash. */
@Injectable()
export class FinanceClaimsService {
  private readonly receivables: FinanceReceivablesService;
  private readonly outgoing: FinanceOutgoingService;
  constructor(@InjectDataSource() private readonly source: DataSource) {
    this.receivables = new FinanceReceivablesService(source);
    this.outgoing = new FinanceOutgoingService(source, []);
  }
  private ids(p: Actor, s: IntegrationScope) {
    return [p.tenantId, s.legalEntityId, s.bookId];
  }
  private identity(actor: Actor): Actor {
    if (actor?.kind !== 'USER')
      throw new ForbiddenException(
        'A trusted Finance claim identity is required.',
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
      "SELECT * FROM finance_claim_authorities WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND subject_id=$4 AND natural_person_id=$5 AND permission=$6 AND currency=$7 AND max_amount>=$8::numeric AND state='ENABLED' AND revoked_at IS NULL AND valid_from<=statement_timestamp() AND valid_to>statement_timestamp() FOR SHARE",
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
        'A unique current scoped claim authority is required.',
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
          'claim authority changed before completion.',
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
      'INSERT INTO finance_claim_audits(tenant_id,legal_entity_id,book_id,object_table,object_id,action,subject_hash,actor_subject_id,actor_natural_person_id,reason) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
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
        'The exact claim reference is unavailable in this book.',
      );
    if (
      hash(row.subject) !== row.subject_hash ||
      canonicalFinanceJson(row.subject) !== row.canonical_subject
    )
      fail('Stored claim content hash differs.');
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
    const snap = normalizeClaims(r.subject.snapshot);
    await verifyAcceptedSource(m, p, s, r.inbox_id, {
      eventType: CLAIMS_EVENT,
      factKind: 'CLAIMS',
      aggregateType: 'CLAIMS',
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
    const g = await this.grant(
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
      g.id !== r.authority_id ||
      hash(integrationSnapshot(g)) !== r.subject.authorityHash
    )
      fail('Frozen claims maker authority changed.');
  }
  private async chain(
    m: EntityManager,
    p: Actor,
    s: IntegrationScope,
    kind: string,
    root: string,
  ) {
    const rows: Row[] = await m.query(
      'SELECT r.*,d.decision FROM finance_claim_records r LEFT JOIN finance_claim_reviews d ON d.record_id=r.id WHERE r.tenant_id=$1 AND r.legal_entity_id=$2 AND r.book_id=$3 AND r.kind=$4 AND r.root_id=$5 ORDER BY source_revision',
      [...this.ids(p, s), kind, root],
    );
    const accepted = rows.filter((r) => r.decision === 'REVIEWED_INACTIVE'),
      head = accepted.find(
        (r) => !accepted.some((n) => n.previous_id === r.id),
      );
    const pending = rows.some(
      (r) =>
        r.decision !== 'REVIEWED_INACTIVE' &&
        !rows.some((n) => n.source_revision > r.source_revision),
    );
    const [{ conflict }] = await m.query(
      "SELECT EXISTS(SELECT 1 FROM finance_claim_aliases a JOIN finance_claim_records r ON r.id=a.record_id WHERE r.tenant_id=$1 AND r.legal_entity_id=$2 AND r.book_id=$3 AND r.kind=$4 AND r.root_id=$5 AND a.state='CONFLICT_HELD') conflict",
      [...this.ids(p, s), kind, root],
    );
    for (const row of accepted) await this.evidence(m, p, s, row);
    return { rows, accepted, head, pending, conflict };
  }
  private async claimCase(
    m: EntityManager,
    p: Actor,
    s: IntegrationScope,
    snap: ClaimsEvidence,
  ) {
    const pos = await this.chain(m, p, s, 'CASE', snap.claimId);
    if (
      !pos.head ||
      pos.pending ||
      pos.conflict ||
      pos.head.id !== snap.caseRef?.id ||
      pos.head.subject_hash !== snap.caseRef?.hash
    )
      fail('The exact current independently reviewed case is required.');
    const base = pos.head!.subject.snapshot;
    if (
      base.sourceCompanyId !== snap.sourceCompanyId ||
      base.policyId !== snap.policyId ||
      base.currency !== snap.currency ||
      base.decimalScale !== snap.decimalScale
    )
      fail('Claim policy, company or currency differs from the case.');
    return pos.head;
  }
  async observe(
    actor: Actor,
    scope: IntegrationScope,
    input: { inboxId: string; snapshot: unknown },
    reason: string,
  ) {
    const raw = cashObject(input.snapshot),
      snap = normalizeClaims(raw);
    return this.command(
      actor,
      scope,
      'OBSERVE_CLAIM',
      snap.currency,
      '0',
      reason,
      async (m, p, s, g) => {
        await verifyAcceptedSource(m, p, s, controlUuid(input.inboxId), {
          eventType: CLAIMS_EVENT,
          factKind: 'CLAIMS',
          aggregateType: 'CLAIMS',
          aggregateId: snap.id,
          companyId: snap.sourceCompanyId,
          revision: snap.sourceRevision,
          snapshotHash: hash(raw),
        });
        const [owner] = await m.query(
          'SELECT * FROM finance_claim_records WHERE tenant_id=$1 AND claim_id=$2 LIMIT 1',
          [p.tenantId, snap.claimId],
        );
        if (
          owner &&
          (owner.book_id !== s.bookId ||
            owner.legal_entity_id !== s.legalEntityId ||
            owner.source_company_id !== snap.sourceCompanyId ||
            owner.policy_id !== snap.policyId ||
            owner.currency !== snap.currency ||
            owner.decimal_scale !== snap.decimalScale)
        )
          throw new ForbiddenException(
            'Claim economic identity belongs to another scope, policy or currency.',
          );
        const [alias] = await m.query(
          'SELECT * FROM finance_claim_aliases WHERE tenant_id=$1 AND book_id=$2 AND inbox_id=$3',
          [p.tenantId, s.bookId, input.inboxId],
        );
        if (alias) {
          if (alias.subject.rawSnapshotHash !== hash(raw))
            fail('Accepted claims inbox content differs.');
          return {
            ...this.result(
              await this.row(m, p, s, 'finance_claim_records', {
                id: alias.record_id,
                hash: alias.subject.recordHash,
              }),
              true,
            ),
            sourceState: alias.state,
            issues: claimsIssues(snap),
          };
        }
        const pos = await this.chain(m, p, s, snap.kind, snap.id),
          old = pos.rows.at(-1),
          vector = hash(claimsVector(snap));
        let row = old,
          state = 'MATCHED';
        if (
          old &&
          old.vector_hash !== vector &&
          pos.head &&
          (!snap.previous ||
            snap.previous.id !== pos.head.id ||
            snap.previous.hash !== pos.head.subject_hash)
        )
          state = 'CONFLICT_HELD';
        else if (!old || old.vector_hash !== vector) {
          if (old && snap.sourceRevision <= old.source_revision)
            fail('Changed claims evidence requires a higher signed revision.');
          row = {
            id: randomUUID(),
            ...this.scope(p, s),
            source_company_id: snap.sourceCompanyId,
            root_id: snap.id,
            source_revision: snap.sourceRevision,
            claim_id: snap.claimId,
            policy_id: snap.policyId,
            kind: snap.kind,
            currency: snap.currency,
            decimal_scale: snap.decimalScale,
            previous_id: snap.previous?.id ?? null,
            inbox_id: input.inboxId,
            vector_hash: vector,
            ...this.content({
              schema: 'FINANCE_CLAIM_RECORD_V1',
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
            'finance_claim_records',
            row,
            'OBSERVE_CLAIM',
            reason,
          );
        }
        if (!row) return fail('Canonical claims evidence is unavailable.');
        const link = {
          id: randomUUID(),
          ...this.scope(p, s),
          record_id: row.id,
          inbox_id: input.inboxId,
          state,
          ...this.content({
            recordHash: row.subject_hash,
            rawSnapshotHash: hash(raw),
            incomingSnapshot: snap,
          }),
          ...this.actor(p, g),
        };
        await this.insert(
          m,
          p,
          s,
          'finance_claim_aliases',
          link,
          state,
          reason,
        );
        return {
          ...this.result(row, !!old),
          sourceState: state,
          issues: claimsIssues(snap),
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
        'Explicit inactive claims review required.',
      );
    const selected = await this.selected(
      actor,
      scope,
      'finance_claim_records',
      ref,
    );
    const value = claimsReviewAmount(selected.subject.snapshot);
    return this.command(
      actor,
      scope,
      'REVIEW_CLAIM',
      selected.currency,
      value,
      reason,
      async (m, p, s, g) => {
        const row = await this.row(m, p, s, 'finance_claim_records', ref),
          snap = await this.evidence(m, p, s, row),
          data: any = snap.data;
        await this.maker(m, p, s, row, 'OBSERVE_CLAIM');
        if (
          row.actor_subject_id === p.subjectId ||
          row.actor_natural_person_id === p.naturalPersonId ||
          data.beneficiary?.naturalPersonIds?.includes(p.naturalPersonId)
        )
          throw new ForbiddenException(
            'Independent claims review is required.',
          );
        const [retry] = await m.query(
          'SELECT * FROM finance_claim_reviews WHERE record_id=$1',
          [row.id],
        );
        if (retry) {
          if (
            retry.decision !== decision ||
            retry.actor_subject_id !== p.subjectId
          )
            fail('Claims review already differs.');
          return this.result(retry, true);
        }
        if (decision === 'REVIEWED_INACTIVE') {
          const pos = await this.chain(m, p, s, snap.kind, snap.id);
          if (
            pos.conflict ||
            pos.rows.some((n) => n.source_revision > snap.sourceRevision)
          )
            fail('Latest unconflicted claims source required.');
          if (
            (pos.head?.id ?? null) !== (snap.previous?.id ?? null) ||
            (pos.head && pos.head.subject_hash !== snap.previous?.hash)
          )
            fail('Claims source chain is stale or out of order.');
          if (claimsIssues(snap).length)
            fail(
              'Claims payment tax, recovery right or source approval remains unresolved.',
            );
          if (snap.kind !== 'CASE') await this.claimCase(m, p, s, snap);
          if (
            snap.kind === 'PAYABLE' &&
            pos.head &&
            hash(pos.head.subject.snapshot.data.beneficiary) !==
              hash(data.beneficiary)
          )
            fail('Revisions cannot redirect an existing claim payee.');
        }
        const r = {
          id: randomUUID(),
          ...this.scope(p, s),
          record_id: row.id,
          decision,
          ...this.content({ recordHash: row.subject_hash, decision }),
          ...this.actor(p, g),
        };
        await this.insert(
          m,
          p,
          s,
          'finance_claim_reviews',
          r,
          'REVIEW_CLAIM',
          reason,
        );
        return this.result(r);
      },
    );
  }
  private async position(
    m: EntityManager,
    p: Actor,
    s: IntegrationScope,
    root: string,
  ) {
    const chain = await this.chain(m, p, s, 'PAYABLE', root),
      head = chain.head,
      d = head?.subject.snapshot.data;
    const [{ legacy_consistent }] = await m.query(
      'SELECT finance_claim_legacy_consistent($1,$2) legacy_consistent',
      [p.tenantId, head?.claim_id ?? root],
    );
    let caseHeld = true,
      caseAvailable = 0n;
    if (head) {
      const cases = await this.chain(m, p, s, 'CASE', head.claim_id);
      caseHeld =
        cases.pending ||
        cases.conflict ||
        cases.head?.id !== head.subject.snapshot.caseRef.id ||
        cases.head?.subject_hash !== head.subject.snapshot.caseRef.hash;
      if (cases.head) {
        const v = cases.head.subject.snapshot.data as CaseVector;
        const [{ reserved }] = await m.query(
          "SELECT COALESCE(sum(amount),0)::text reserved FROM finance_claim_settlements r WHERE r.tenant_id=$1 AND r.claim_id=$2 AND NOT EXISTS(SELECT 1 FROM finance_claim_events e WHERE e.settlement_id=r.id AND e.action IN ('REJECT','CANCEL'))",
          [p.tenantId, head.claim_id],
        );
        caseAvailable =
          claimLimit(v) -
          units(v.paidIndemnity) -
          units(v.paidExpenses) -
          units(v.legacyReserved) -
          units(reserved);
      }
    }
    const [{ reserved }] = await m.query(
      "SELECT COALESCE(sum(amount),0)::text reserved FROM finance_claim_settlements r WHERE r.tenant_id=$1 AND r.root_id=$2 AND NOT EXISTS(SELECT 1 FROM finance_claim_events e WHERE e.settlement_id=r.id AND e.action IN ('REJECT','CANCEL'))",
      [p.tenantId, root],
    );
    const own = d
      ? units(d.amount) -
        units(d.legacyPaid) -
        units(d.legacyReserved) -
        units(reserved)
      : 0n;
    return {
      ...chain,
      pending:
        chain.pending ||
        caseHeld ||
        !legacy_consistent ||
        d?.writer !== 'HANDOFF_RECONCILED',
      legacyConsistent: legacy_consistent,
      payable: d ? units(d.amount) : 0n,
      legacyPaid: d ? units(d.legacyPaid) : 0n,
      legacyReserved: d ? units(d.legacyReserved) : 0n,
      reserved: units(reserved),
      caseAvailable,
      available: own < caseAvailable ? own : caseAvailable,
    };
  }
  private async current(
    m: EntityManager,
    p: Actor,
    s: IntegrationScope,
    r: Row,
    approved = true,
  ) {
    const pos = await this.position(m, p, s, r.root_id);
    const events: Row[] = await m.query(
      'SELECT * FROM finance_claim_events WHERE settlement_id=$1 ORDER BY created_at,id',
      [r.id],
    );
    const [{ eligible }] = await m.query(
      'SELECT finance_claim_eligible($1,$2) eligible',
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
        'Claim settlement is unapproved, expired, stale or exceeds entitlement.',
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
      'finance_claim_records',
      plan.head,
    );
    if (selected.kind !== 'PAYABLE')
      throw new BadRequestException('A reviewed claim payable is required.');
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
          'SELECT * FROM finance_claim_settlements WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND command_key=$4',
          [...this.ids(p, s), plan.commandKey],
        );
        if (old) {
          if (
            hash(old.subject.plan) !== hash(plan) ||
            old.actor_subject_id !== p.subjectId
          )
            fail('Claim settlement command differs.');
          return this.result(old, true);
        }
        const r = await this.row(m, p, s, 'finance_claim_records', plan.head),
          pos = await this.position(m, p, s, r.root_id);
        if (
          pos.pending ||
          pos.conflict ||
          pos.head?.id !== r.id ||
          units(plan.amount) > pos.available
        )
          fail('Current claim payable is insufficient or held.');
        if (
          hash(plan.beneficiary) !== hash(r.subject.snapshot.data.beneficiary)
        )
          fail('Exact claim-party beneficiary is required.');
        const row = {
          id: randomUUID(),
          ...this.scope(p, s),
          root_id: r.root_id,
          claim_id: r.claim_id,
          head_id: r.id,
          command_key: plan.commandKey,
          amount: plan.amount,
          currency: r.currency,
          decimal_scale: r.decimal_scale,
          beneficiary_hash: hash(plan.beneficiary),
          expires_at: plan.expiresAt,
          ...this.content({
            schema: 'FINANCE_CLAIM_SETTLEMENT_V1',
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
          'finance_claim_settlements',
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
      'SELECT * FROM finance_claim_events WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND command_key=$4',
      [...this.ids(p, s), key],
    );
    if (old) {
      if (
        old.settlement_id !== r.id ||
        old.action !== action ||
        old.actor_subject_id !== p.subjectId ||
        hash(old.subject) !== hash(subject)
      )
        fail('Claim event command differs.');
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
    await this.insert(m, p, s, 'finance_claim_events', row, action, reason);
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
        'Explicit claim settlement decision required.',
      );
    const selected = await this.selected(
      actor,
      scope,
      'finance_claim_settlements',
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
        const r = await this.row(m, p, s, 'finance_claim_settlements', ref);
        if (
          p.subjectId === r.actor_subject_id ||
          p.naturalPersonId === r.actor_natural_person_id ||
          r.subject.plan.beneficiary.naturalPersonIds.includes(
            p.naturalPersonId,
          )
        )
          throw new ForbiddenException(
            'Independent claim settlement checker is required.',
          );
        if (action === 'APPROVE') {
          await this.maker(m, p, s, r, 'PREPARE_SETTLEMENT', r.amount);
          await this.current(m, p, s, r, false);
          if (new Date(g.valid_to) < new Date(r.expires_at))
            fail('Checker authority must cover settlement lifetime.');
        }
        if (action !== 'APPROVE')
          for (const link of await m.query(
            "SELECT * FROM finance_claim_events WHERE settlement_id=$1 AND action='BIND_EXECUTION'",
            [r.id],
          )) {
            const cash = await this.outgoing.verifiedReference(
              m,
              p,
              s,
              link.subject.details.intent,
            );
            if (!['CANCELLED', 'FAILED_FINAL'].includes(cash.position.state))
              fail('Active or confirmed claim cash cannot release capacity.');
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
      'finance_claim_settlements',
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
        const r = await this.row(m, p, s, 'finance_claim_settlements', ref);
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
          fail('Claim funding company, book and currency must agree.');
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
      'finance_claim_settlements',
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
        const r = await this.row(m, p, s, 'finance_claim_settlements', ref),
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
          fail('Exact approved unexecuted claim intent is required.');
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
          fail('Claim executions exceed the approved settlement.');
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
      'finance_claim_settlements',
      ref,
    );
    return this.command(
      actor,
      scope,
      'RECONCILE_CLAIM',
      selected.currency,
      selected.amount,
      reason,
      async (m, p, s, g) => {
        const r = await this.row(m, p, s, 'finance_claim_settlements', ref);
        if (
          p.naturalPersonId === r.actor_natural_person_id ||
          r.subject.plan.beneficiary.naturalPersonIds.includes(
            p.naturalPersonId,
          )
        )
          throw new ForbiddenException(
            'Independent claim reconciliation is required.',
          );
        let principal = 0n,
          fees = 0n,
          uncertain = false,
          exception = false,
          bankMatched = true;
        const executions: Row[] = [],
          seen = new Set<string>();
        for (const link of await m.query(
          "SELECT * FROM finance_claim_events WHERE settlement_id=$1 AND action='BIND_EXECUTION'",
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
        const pos = await this.position(m, p, s, r.root_id);
        exception ||=
          pos.pending ||
          pos.available < 0n ||
          pos.conflict ||
          principal > units(r.amount);
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
                  : 'NO_CONFIRMED_CLAIM';
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

  private async recoveryPosition(
    m: EntityManager,
    p: Actor,
    s: IntegrationScope,
    r: Row,
  ) {
    const pos = await this.chain(m, p, s, 'RECOVERY', r.root_id);
    const [{ reserved }] = await m.query(
      'SELECT finance_claim_recovery_reserved($1,$2)::text reserved',
      [p.tenantId, r.root_id],
    );
    const d = pos.head?.subject.snapshot.data;
    return {
      ...pos,
      available: d
        ? units(d.expected) - units(d.legacyReceived) - units(reserved)
        : 0n,
      reserved: units(reserved),
    };
  }
  async prepareRecoveryReceipt(
    actor: Actor,
    scope: IntegrationScope,
    input: unknown,
    reason: string,
  ) {
    const plan: any = cashObject(input);
    approvalFields(plan, ['commandKey', 'recovery', 'receipt', 'amount']);
    plan.commandKey = cashText(plan.commandKey, 160);
    plan.recovery = changeRef(plan.recovery);
    plan.receipt = changeRef(plan.receipt);
    const selected = await this.selected(
      actor,
      scope,
      'finance_claim_records',
      plan.recovery,
    );
    if (selected.kind !== 'RECOVERY')
      throw new BadRequestException('A reviewed legal recovery is required.');
    plan.amount = cashAmount(plan.amount, selected.decimal_scale, true);
    return this.command(
      actor,
      scope,
      'PREPARE_RECOVERY',
      selected.currency,
      plan.amount,
      reason,
      async (m, p, s, g) => {
        const [old] = await m.query(
          'SELECT * FROM finance_claim_recovery_receipts WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND command_key=$4',
          [...this.ids(p, s), plan.commandKey],
        );
        if (old) {
          if (
            hash(old.subject.plan) !== hash(plan) ||
            old.actor_subject_id !== p.subjectId
          )
            fail('Recovery receipt command differs.');
          return this.result(old, true);
        }
        const r = await this.row(
            m,
            p,
            s,
            'finance_claim_records',
            plan.recovery,
          ),
          snap = await this.evidence(m, p, s, r),
          d: any = snap.data,
          pos = await this.recoveryPosition(m, p, s, r);
        await this.claimCase(m, p, s, snap);
        const cash = await this.receivables.verifiedReceipt(
          m,
          p,
          s,
          plan.receipt,
        );
        if (
          pos.head?.id !== r.id ||
          pos.pending ||
          pos.conflict ||
          claimsIssues(snap).length ||
          cash.sourceConflicts ||
          cash.billingLineageHolds ||
          cash.receipt.source_company_id !== r.source_company_id ||
          cash.receipt.customer_id !== d.debtorId ||
          cash.receipt.currency !== r.currency ||
          cash.receipt.decimal_scale !== r.decimal_scale ||
          units(plan.amount) > pos.available ||
          units(plan.amount) > signedUnits(cash.available)
        )
          fail(
            'Recovery right, debtor, source receipt or available capacity differs.',
          );
        const row = {
          id: randomUUID(),
          ...this.scope(p, s),
          root_id: r.root_id,
          claim_id: r.claim_id,
          recovery_id: r.id,
          receipt_id: plan.receipt.id,
          command_key: plan.commandKey,
          amount: plan.amount,
          currency: r.currency,
          decimal_scale: r.decimal_scale,
          ...this.content({
            plan,
            recoveryHash: r.subject_hash,
            authorityHash: hash(integrationSnapshot(g)),
            purpose: 'INACTIVE_CONTROLS_ONLY',
          }),
          ...this.actor(p, g),
        };
        await this.insert(
          m,
          p,
          s,
          'finance_claim_recovery_receipts',
          row,
          'PREPARE_RECOVERY',
          reason,
        );
        return this.result(row);
      },
    );
  }
  async reviewRecoveryReceipt(
    actor: Actor,
    scope: IntegrationScope,
    ref: ChangeRef,
    action: 'APPROVE' | 'REJECT' | 'REVERSE',
    key: string,
    reason: string,
  ) {
    if (!['APPROVE', 'REJECT', 'REVERSE'].includes(action))
      throw new BadRequestException(
        'Explicit recovery allocation decision required.',
      );
    key = cashText(key, 160);
    const selected = await this.selected(
      actor,
      scope,
      'finance_claim_recovery_receipts',
      ref,
    );
    return this.command(
      actor,
      scope,
      'REVIEW_RECOVERY',
      selected.currency,
      selected.amount,
      reason,
      async (m, p, s, g) => {
        const r = await this.row(
          m,
          p,
          s,
          'finance_claim_recovery_receipts',
          ref,
        );
        if (
          r.actor_subject_id === p.subjectId ||
          r.actor_natural_person_id === p.naturalPersonId
        )
          throw new ForbiddenException(
            'Independent recovery receipt review required.',
          );
        const [retry] = await m.query(
          'SELECT * FROM finance_claim_recovery_decisions WHERE tenant_id=$1 AND book_id=$2 AND command_key=$3',
          [p.tenantId, s.bookId, key],
        );
        if (retry) {
          if (
            retry.receipt_id !== r.id ||
            retry.action !== action ||
            retry.actor_subject_id !== p.subjectId
          )
            fail('Recovery review command differs.');
          return this.result(retry, true);
        }
        const events: Row[] = await m.query(
          'SELECT * FROM finance_claim_recovery_decisions WHERE receipt_id=$1',
          [r.id],
        );
        if (action === 'APPROVE') {
          await this.maker(m, p, s, r, 'PREPARE_RECOVERY', r.amount);
          const evidence = await this.row(
              m,
              p,
              s,
              'finance_claim_records',
              r.subject.plan.recovery,
            ),
            snap = await this.evidence(m, p, s, evidence),
            pos = await this.recoveryPosition(m, p, s, evidence),
            cash = await this.receivables.verifiedReceipt(
              m,
              p,
              s,
              r.subject.plan.receipt,
            );
          await this.claimCase(m, p, s, snap);
          if (
            pos.head?.id !== evidence.id ||
            pos.pending ||
            pos.conflict ||
            pos.available < 0n ||
            cash.sourceConflicts ||
            cash.billingLineageHolds ||
            signedUnits(cash.available) < 0n ||
            events.length
          )
            fail('Recovery allocation is stale, conflicted or over capacity.');
        } else if (
          action === 'REVERSE' &&
          (!events.some((e) => e.action === 'APPROVE') ||
            events.some((e) => e.action === 'REVERSE'))
        )
          fail(
            'Reverse the exact approved recovery allocation once; the bank receipt is retained.',
          );
        else if (action === 'REJECT' && events.length)
          fail('Recovery allocation already has a decision.');
        const row = {
          id: randomUUID(),
          ...this.scope(p, s),
          receipt_id: r.id,
          action,
          command_key: key,
          ...this.content({ receiptHash: r.subject_hash, action }),
          ...this.actor(p, g),
        };
        await this.insert(
          m,
          p,
          s,
          'finance_claim_recovery_decisions',
          row,
          action,
          reason,
        );
        return {
          ...this.result(row),
          bankReceiptReversed: false,
          legacyRecoveryWritten: false,
        };
      },
    );
  }
  async read(actor: Actor, scope: IntegrationScope, ref: ChangeRef) {
    const selected = await this.selected(
      actor,
      scope,
      'finance_claim_records',
      ref,
    );
    return this.command(
      actor,
      scope,
      'READ_CLAIM',
      selected.currency,
      '0',
      'Read inactive claims components',
      async (m, p, s) => {
        const row = await this.row(m, p, s, 'finance_claim_records', ref),
          snap = await this.evidence(m, p, s, row),
          pos = await this.chain(m, p, s, snap.kind, snap.id);
        const data: any = pos.head?.subject.snapshot.data ?? snap.data;
        const common = {
          ...this.result(row),
          kind: snap.kind,
          claimId: snap.claimId,
          currency: snap.currency,
          sourcePending: pos.pending,
          sourceConflict: pos.conflict,
          head: pos.head
            ? { id: pos.head.id, hash: pos.head.subject_hash }
            : null,
          reviewedVersions: pos.accepted.map((r) => ({
            id: r.id,
            hash: r.subject_hash,
            sourceRevision: r.source_revision,
            effectiveDate: r.subject.snapshot.effectiveDate,
            components: r.subject.snapshot.data,
          })),
          holds: [
            ...claimsIssues(snap),
            'UNRESOLVED_ACCOUNTING_POLICIES',
            'LEGACY_SOURCE_AND_CASH_RECONCILIATION_REQUIRED',
          ],
          sourceFinancialWrites: 0,
          legacyClaimsWrites: 0,
        };
        if (snap.kind === 'CASE')
          return {
            ...common,
            components: data,
            holds: [
              ...common.holds,
              ...(signedUnits(data.caseOutstanding) < 0n
                ? ['CASE_OVERPAYMENT_OR_OVER_RELEASE_RECONCILIATION_REQUIRED']
                : []),
            ],
            measurement: licComparison(data),
            recoveryNettingEffects: 0,
          };
        if (snap.kind === 'PAYABLE') {
          const pay = await this.position(m, p, s, snap.id);
          return {
            ...common,
            payable: decimal(pay.payable),
            legacyPaid: decimal(pay.legacyPaid),
            legacyReserved: decimal(pay.legacyReserved),
            reserved: decimal(pay.reserved),
            available: decimal(pay.available),
            caseAvailable: decimal(pay.caseAvailable),
            paymentHeld: pay.pending || pay.conflict || pay.available < 0n,
            holds: [
              ...common.holds,
              ...(!pay.legacyConsistent
                ? ['LEGACY_CLAIM_BASELINE_RECONCILIATION_REQUIRED']
                : []),
              ...(pay.available < 0n
                ? ['CLAIM_SETTLEMENT_EXCEEDS_REVISED_ENTITLEMENT']
                : []),
            ],
            settlementExpenseEffects: 0,
          };
        }
        const recovery = await this.recoveryPosition(m, p, s, row);
        return {
          ...common,
          components: data,
          reserved: decimal(recovery.reserved),
          available: decimal(recovery.available),
          allocationHeld:
            recovery.pending || recovery.conflict || recovery.available < 0n,
          holds: [
            ...common.holds,
            ...(recovery.available < 0n
              ? ['RECOVERY_ALLOCATIONS_EXCEED_REVISED_RIGHT']
              : []),
          ],
          legalRecognitionEffects: 0,
          reinsuranceNettingEffects: 0,
        };
      },
    );
  }
}
