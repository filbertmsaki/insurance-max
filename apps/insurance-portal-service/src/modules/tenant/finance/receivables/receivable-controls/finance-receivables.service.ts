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
  integrationBook,
  integrationScope,
  integrationSnapshot,
} from '../../integrations/finance-events/finance-integration.controls';
import type { IntegrationScope } from '../../integrations/finance-events/finance-integration.types';
import {
  candidateAmount,
  candidateText,
} from '../../accounting/journal-entries/finance-journal-candidate.types';
import { verifyAcceptedSource } from '../../integrations/source-evidence/finance-accepted-source';
import { FinanceQuotationBillingService } from '../../integrations/quotation-finance/finance-quotation-billing.service';
import {
  RECEIVABLE_EVENT,
  RECEIVABLE_HOLDS,
  controlUuid,
  controlHash,
  controlAmount,
  controlUnits,
  controlDate,
  normalizeReceivableEvidence,
  receivableProfile,
  receiptIdentity,
  receiptVector,
  dueAgeing,
  type ReceiptEvidence,
  type TermsEvidence,
  type ReceivableProfile,
} from './finance-receivables.types';
type Row = Record<string, any>;
type Actor = FinanceConfigurationActor;
type Permission =
  | 'OBSERVE_RECEIPT'
  | 'PREPARE_ASSIGNMENT'
  | 'REVIEW_ASSIGNMENT'
  | 'RECONCILE_RECEIPT'
  | 'READ_RECEIVABLES';
interface ProfileRef {
  profileId: string;
  profileHash: string;
}
function identity(p: Actor): Actor {
  if (!p || p.kind !== 'USER')
    throw new ForbiddenException(
      'A trusted human receivable identity is required.',
    );
  return Object.freeze({
    kind: 'USER',
    tenantId: controlUuid(p.tenantId),
    subjectId: controlUuid(p.subjectId),
    naturalPersonId: controlUuid(p.naturalPersonId),
  });
}
function detached<T>(v: T): T {
  return JSON.parse(canonicalFinanceJson(v));
}
function conflict(message: string): never {
  throw new ConflictException(message);
}
/** Internal control records only. No legacy invoice, receipt, account, journal or payment writer is injected. */
@Injectable()
export class FinanceReceivablesService {
  private readonly billing: FinanceQuotationBillingService;
  constructor(@InjectDataSource() private readonly source: DataSource) {
    this.billing = new FinanceQuotationBillingService(source);
  }
  private async grant(
    m: EntityManager,
    p: Actor,
    s: IntegrationScope,
    permission: Permission,
    lock = true,
  ) {
    const sql = `SELECT * FROM finance_receivable_authorities WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND subject_id=$4 AND natural_person_id=$5 AND permission=$6 AND state='ENABLED' AND revoked_at IS NULL AND valid_from<=statement_timestamp() AND (valid_to IS NULL OR valid_to>statement_timestamp()) ORDER BY id LIMIT 1${lock ? ' FOR SHARE' : ''}`,
      args = [
        p.tenantId,
        s.legalEntityId,
        s.bookId,
        p.subjectId,
        p.naturalPersonId,
        permission,
      ];
    const [g] = await m.query(sql, args);
    if (!g)
      throw new ForbiddenException(
        'Current exact scoped receivable authority is required.',
      );
    const fingerprint = hash(integrationSnapshot(g));
    return {
      id: g.id,
      hash: fingerprint,
      verify: async () => {
        const [now] = await m.query(sql, args);
        if (
          !now ||
          now.id !== g.id ||
          hash(integrationSnapshot(now)) !== fingerprint
        )
          throw new ForbiddenException(
            'Receivable authority changed or expired before completion.',
          );
      },
    };
  }
  private async command<T>(
    p: Actor,
    s: IntegrationScope,
    permission: Permission,
    reason: string,
    run: (
      m: EntityManager,
      g: Awaited<ReturnType<FinanceReceivablesService['grant']>>,
    ) => Promise<T>,
  ) {
    if (!candidateText(reason, 2000))
      throw new BadRequestException(
        'An explicit receivable control evidence reason is required.',
      );
    return this.source.transaction(async (m) => {
      await m.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        'finance-inactive-config:' + p.tenantId,
      ]);
      await integrationBook(
        m,
        { kind: 'WORKER', tenantId: p.tenantId, subjectId: p.subjectId },
        s,
      );
      const g = await this.grant(m, p, s, permission),
        result = await run(m, g);
      await g.verify();
      return result;
    });
  }
  private ref(v: ProfileRef): ProfileRef {
    return {
      profileId: controlUuid(v?.profileId),
      profileHash: controlHash(v?.profileHash),
    };
  }
  private async profile(
    m: EntityManager,
    p: Actor,
    s: IntegrationScope,
    ref: ProfileRef,
  ) {
    const [r] = await m.query(
      "SELECT * FROM finance_configuration_releases WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND id=$4 AND release_hash=$5 AND kind='RECEIVABLE_CONTROLS' AND state='REVIEWED_INACTIVE' AND effective_from<=(statement_timestamp() AT TIME ZONE 'UTC')::date AND (effective_to IS NULL OR effective_to>(statement_timestamp() AT TIME ZONE 'UTC')::date) FOR SHARE",
      [p.tenantId, s.legalEntityId, s.bookId, ref.profileId, ref.profileHash],
    );
    if (!r)
      conflict(
        'An exact current reviewed inactive receivable profile is required.',
      );
    return receivableProfile(r.payload, r.dependency_refs);
  }
  private owner(policy: ReceivableProfile, s: ReceiptEvidence) {
    if (
      !policy.cashAccounts.some(
        (a) =>
          a.sourceAccountId === s.sourceAccountId &&
          a.sourceCompanyId === s.sourceCompanyId &&
          a.currency === s.currency &&
          a.decimalScale === s.decimalScale,
      )
    )
      conflict(
        'Receipt ownership, source cash account, currency or scale is not declared by this scoped profile.',
      );
  }
  private async evidence(
    m: EntityManager,
    p: Actor,
    s: IntegrationScope,
    inboxId: string,
    raw: unknown,
    snapshot: ReceiptEvidence | TermsEvidence,
    deliveryId: string | null = null,
  ) {
    return verifyAcceptedSource(
      m,
      p,
      s,
      inboxId,
      {
        eventType: RECEIVABLE_EVENT,
        factKind: 'RECEIVABLE_EVIDENCE',
        aggregateType: 'RECEIVABLE_EVIDENCE',
        aggregateId: (raw as Row).id,
        companyId: snapshot.sourceCompanyId,
        revision: snapshot.sourceRevision,
        snapshotHash: hash(raw),
      },
      deliveryId,
    );
  }
  private async insert(m: EntityManager, table: string, row: Row) {
    const keys = Object.keys(row);
    await m.query(
      `INSERT INTO ${table}(${keys.join(',')}) VALUES(${keys.map((_, i) => '$' + (i + 1)).join(',')})`,
      Object.values(row),
    );
  }
  private async audit(
    m: EntityManager,
    p: Actor,
    s: IntegrationScope,
    kind: string,
    row: Row,
    action: string,
    reason: string,
  ) {
    await this.insert(m, 'finance_receivable_audits', {
      tenant_id: p.tenantId,
      legal_entity_id: s.legalEntityId,
      book_id: s.bookId,
      object_kind: kind,
      object_id: row.id,
      action,
      subject_hash: row.subject_hash,
      actor_subject_id: p.subjectId,
      actor_natural_person_id: p.naturalPersonId,
      reason,
    });
  }
  private scope(p: Actor, s: IntegrationScope) {
    return {
      tenant_id: p.tenantId,
      legal_entity_id: s.legalEntityId,
      book_id: s.bookId,
    };
  }
  private result(row: Row, reused = false) {
    return {
      id: row.id,
      hash: row.subject_hash,
      reused,
      accountingState: 'HELD_INACTIVE',
      dischargeState: 'LEGAL_DISCHARGE_HELD',
      financialEffects: 0,
      holds: [...RECEIVABLE_HOLDS],
    };
  }
  private maker(p: Actor, g: { id: string; hash: string }) {
    return {
      subjectId: p.subjectId,
      naturalPersonId: p.naturalPersonId,
      grantId: g.id,
      grantHash: g.hash,
    };
  }
  async observeReceipt(
    p: Actor,
    s: IntegrationScope,
    input: ProfileRef & { inboxId: string; snapshot: unknown },
    reason: string,
  ) {
    p = identity(p);
    s = integrationScope(s);
    input = detached(input);
    const ref = this.ref(input),
      inboxId = controlUuid(input.inboxId),
      snapshot = normalizeReceivableEvidence(input.snapshot);
    if (snapshot.kind !== 'CONFIRMED_RECEIPT')
      throw new BadRequestException('Confirmed receipt evidence is required.');
    return this.command(p, s, 'OBSERVE_RECEIPT', reason, async (m, g) => {
      const policy = await this.profile(m, p, s, ref);
      this.owner(policy, snapshot);
      const e = await this.evidence(m, p, s, inboxId, input.snapshot, snapshot);
      const [old] = await m.query(
        'SELECT * FROM finance_receipt_sources WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND inbox_id=$4',
        [p.tenantId, s.legalEntityId, s.bookId, inboxId],
      );
      if (old) {
        if (
          hash(old.subject) !== old.subject_hash ||
          hash(old.subject.rawSnapshot) !== hash(input.snapshot) ||
          old.subject.profileHash !== ref.profileHash
        )
          conflict(
            'An existing receipt source has different immutable evidence.',
          );
        return {
          ...this.result(old, true),
          receiptId: old.receipt_id,
          state: old.state,
        };
      }
      const bankHash = hash(receiptIdentity(snapshot)),
        vectorHash = hash(receiptVector(snapshot));
      const [canonical] = await m.query(
        'SELECT * FROM finance_confirmed_receipts WHERE tenant_id=$1 AND legal_entity_id=$2 AND bank_identity_hash=$3 FOR UPDATE',
        [p.tenantId, s.legalEntityId, bankHash],
      );
      const priorSource = await m.query(
        "SELECT * FROM finance_receipt_sources WHERE tenant_id=$1 AND legal_entity_id=$2 AND source_system=$3 AND source_id=$4 AND state IN ('RECORDED','ALIASED')",
        [p.tenantId, s.legalEntityId, e.source_system, snapshot.id],
      );
      let state = 'RECORDED',
        receiptId: string | null = null;
      if (canonical) {
        if (
          canonical.book_id !== s.bookId ||
          canonical.vector_hash !== vectorHash
        )
          state = 'CONFLICT_HELD';
        else {
          await this.receipt(m, p, s, canonical.id);
          state = 'ALIASED';
          receiptId = canonical.id;
        }
      }
      if (
        priorSource.some(
          (a: Row) =>
            a.book_id !== s.bookId ||
            !canonical ||
            a.receipt_id !== canonical.id,
        )
      )
        state = 'CONFLICT_HELD';
      if (state === 'CONFLICT_HELD') {
        receiptId = canonical?.book_id === s.bookId ? canonical.id : null;
      }
      const proof = {
        inboxId,
        deliveryId: e.delivery_id,
        rawSnapshot: input.snapshot,
        rawHash: hash(input.snapshot),
        profileId: ref.profileId,
        profileHash: ref.profileHash,
        profileSnapshot: policy,
        maker: this.maker(p, g),
      };
      if (state === 'RECORDED') {
        receiptId = randomUUID();
        const subject = {
          schema: 'FINANCE_CONFIRMED_RECEIPT_V1',
          tenantId: p.tenantId,
          ...s,
          snapshot,
          bankIdentityHash: bankHash,
          vectorHash,
          proof,
          accountingState: 'HELD_INACTIVE',
          financialEffects: 0,
        };
        const row = {
          id: receiptId,
          ...this.scope(p, s),
          bank_identity_hash: bankHash,
          vector_hash: vectorHash,
          subject,
          subject_hash: hash(subject),
          source_company_id: snapshot.sourceCompanyId,
          source_account_id: snapshot.sourceAccountId,
          customer_id: snapshot.customerId,
          currency: snapshot.currency,
          decimal_scale: snapshot.decimalScale,
          received: snapshot.received,
          bank_settled: snapshot.bankSettled,
          bank_fee: snapshot.bankFee,
          legacy_allocated: snapshot.legacyAllocated,
          legacy_refunded: snapshot.legacyRefunded,
          legacy_reserved: snapshot.legacyReserved,
          value_date: snapshot.valueDate,
        };
        await this.insert(m, 'finance_confirmed_receipts', row);
        await this.audit(
          m,
          p,
          s,
          'RECEIPT',
          row,
          'CASH_CONFIRMED_HELD',
          reason,
        );
      }
      const subject = {
        schema: 'FINANCE_RECEIPT_SOURCE_V1',
        ...proof,
        receiptId,
        state,
        snapshot,
        ownerSubjectId: p.subjectId,
        ownerNaturalPersonId: p.naturalPersonId,
      };
      const row = {
        id: randomUUID(),
        ...this.scope(p, s),
        receipt_id: receiptId,
        inbox_id: inboxId,
        delivery_id: e.delivery_id,
        source_system: e.source_system,
        source_id: snapshot.id,
        subject,
        subject_hash: hash(subject),
        state,
        maker_subject_id: p.subjectId,
        maker_natural_person_id: p.naturalPersonId,
        maker_grant_id: g.id,
      };
      await this.insert(m, 'finance_receipt_sources', row);
      await this.audit(
        m,
        p,
        s,
        'SOURCE',
        row,
        state === 'CONFLICT_HELD' ? 'OWNED_CONFLICT_HELD' : 'SOURCE_RECORDED',
        reason,
      );
      await this.profile(m, p, s, ref);
      return { ...this.result(row), receiptId, state };
    });
  }
  private async receipt(
    m: EntityManager,
    p: Actor,
    s: IntegrationScope,
    id: string,
  ) {
    const [r] = await m.query(
      'SELECT r.*,r.value_date::text AS value_date FROM finance_confirmed_receipts r WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND id=$4',
      [p.tenantId, s.legalEntityId, s.bookId, id],
    );
    if (!r)
      throw new ForbiddenException('Receipt is unavailable in this scope.');
    const snap = normalizeReceivableEvidence(r.subject.snapshot);
    if (snap.kind !== 'CONFIRMED_RECEIPT')
      conflict('Stored receipt evidence kind differs.');
    if (
      hash(r.subject) !== r.subject_hash ||
      hash(receiptIdentity(snap)) !== r.bank_identity_hash ||
      hash(receiptVector(snap)) !== r.vector_hash ||
      r.received !== snap.received ||
      r.bank_settled !== snap.bankSettled ||
      r.bank_fee !== snap.bankFee ||
      r.legacy_allocated !== snap.legacyAllocated ||
      r.legacy_refunded !== snap.legacyRefunded ||
      r.legacy_reserved !== snap.legacyReserved ||
      r.currency !== snap.currency ||
      r.decimal_scale !== snap.decimalScale ||
      r.customer_id !== snap.customerId ||
      r.source_company_id !== snap.sourceCompanyId ||
      r.source_account_id !== snap.sourceAccountId ||
      r.value_date !== snap.valueDate
    )
      conflict(
        'Stored receipt vector or ownership differs from its immutable evidence.',
      );
    const proof = r.subject.proof;
    await this.evidence(
      m,
      p,
      s,
      proof.inboxId,
      proof.rawSnapshot,
      snap,
      proof.deliveryId,
    );
    return r;
  }
  private async requests(
    m: EntityManager,
    p: Actor,
    s: IntegrationScope,
    filter: 'receipt_id' | 'economic_root',
    value: string,
    asOf: string | null = null,
  ) {
    const rows: Row[] = await m.query(
      `SELECT x.*,x.due_date::text AS due_date,d.id AS decision_id,d.decision,d.subject AS decision_subject,d.subject_hash AS decision_hash FROM finance_receivable_requests x JOIN finance_quotation_memoranda b ON b.id=x.memo_id LEFT JOIN finance_receivable_decisions d ON d.request_id=x.id AND ($5::date IS NULL OR d.created_at<(($5::date+1)::timestamp AT TIME ZONE 'UTC')) WHERE x.tenant_id=$1 AND x.legal_entity_id=$2 AND x.book_id=$3 AND ${filter === 'receipt_id' ? 'x.receipt_id' : 'b.economic_root'}=$4 AND ($5::date IS NULL OR x.created_at<(($5::date+1)::timestamp AT TIME ZONE 'UTC')) ORDER BY x.id`,
      [p.tenantId, s.legalEntityId, s.bookId, value, asOf],
    );
    for (const r of rows) {
      if (
        hash(r.subject) !== r.subject_hash ||
        r.subject.amount !== r.amount ||
        r.subject.kind !== r.kind ||
        r.subject.memoId !== r.memo_id ||
        r.subject.receiptId !== r.receipt_id ||
        r.subject.originalId !== r.original_id ||
        r.subject.currency !== r.currency ||
        r.subject.decimalScale !== r.decimal_scale ||
        r.subject.dueDate !== r.due_date
      )
        conflict('Stored receivable request vector differs.');
      if (
        r.decision_id &&
        (hash(r.decision_subject) !== r.decision_hash ||
          r.decision_subject.requestHash !== r.subject_hash ||
          r.decision_subject.decision !== r.decision)
      )
        conflict('Stored receivable review differs.');
    }
    return rows;
  }
  private totals(rows: Row[]) {
    let assigned = 0n,
      pending = 0n,
      reversed = 0n;
    for (const r of rows) {
      if (r.kind === 'ALLOCATE') {
        if (!r.decision_id) pending += controlUnits(r.amount);
        else if (r.decision === 'REVIEWED_INACTIVE')
          assigned += controlUnits(r.amount);
      } else if (r.kind === 'REVERSE' && r.decision === 'REVIEWED_INACTIVE')
        reversed += controlUnits(r.amount);
    }
    return { assigned, pending, reversed, net: assigned - reversed };
  }
  private async receiptPosition(
    m: EntityManager,
    p: Actor,
    s: IntegrationScope,
    id: string,
  ) {
    const r = await this.receipt(m, p, s, id),
      requests = await this.requests(m, p, s, 'receipt_id', id),
      t = this.totals(requests),
      sources: Row[] = await m.query(
        'SELECT * FROM finance_receipt_sources WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND receipt_id=$4 ORDER BY id',
        [p.tenantId, s.legalEntityId, s.bookId, id],
      );
    for (const v of sources) {
      if (
        hash(v.subject) !== v.subject_hash ||
        v.subject.state !== v.state ||
        v.subject.receiptId !== v.receipt_id
      )
        conflict('Stored receipt source history differs.');
      const snap = normalizeReceivableEvidence(v.subject.rawSnapshot);
      await this.evidence(
        m,
        p,
        s,
        v.inbox_id,
        v.subject.rawSnapshot,
        snap,
        v.delivery_id,
      );
    }
    const legacy =
        controlUnits(r.legacy_allocated) +
        controlUnits(r.legacy_refunded) +
        controlUnits(r.legacy_reserved),
      recoveryReserved = await this.claimRecoveryReservations(m, id),
      available =
        controlUnits(r.received) -
        legacy -
        t.net -
        t.pending -
        recoveryReserved;
    const billingHeads: Row[] = [];
    for (const memoId of [...new Set(requests.map((v) => v.memo_id))]) {
      const b = await this.memoPosition(m, p, s, memoId),
        local = this.totals(requests.filter((v) => v.memo_id === memoId));
      billingHeads.push({
        memoId,
        hash: b.b.subject_hash,
        headRevision: b.headRevision,
        current: b.sourceCurrent,
        active: local.net + local.pending > 0n,
      });
    }
    const state = {
      receiptId: id,
      receiptHash: r.subject_hash,
      currency: r.currency,
      decimalScale: r.decimal_scale,
      received: r.received,
      bankSettled: r.bank_settled,
      bankFee: r.bank_fee,
      legacyUnavailable: controlAmount(legacy),
      assigned: controlAmount(t.net),
      pending: controlAmount(t.pending),
      ...(recoveryReserved > 0n
        ? { claimRecoveryReserved: controlAmount(recoveryReserved) }
        : {}),
      available: controlAmount(available),
      sourceConflicts: sources.filter((v) => v.state === 'CONFLICT_HELD')
        .length,
      billingLineageHolds: billingHeads.filter((b) => !b.current && b.active)
        .length,
      billingHeads,
      sourceHistory: sources.map((v) => ({
        id: v.id,
        hash: v.subject_hash,
        state: v.state,
      })),
      requestHistory: requests.map((v) => ({
        id: v.id,
        hash: v.subject_hash,
        decisionHash: v.decision_hash ?? null,
        decision: v.decision ?? 'PENDING',
      })),
      accountingState: 'HELD_INACTIVE',
      dischargeState: 'LEGAL_DISCHARGE_HELD',
      financialEffects: 0,
    };
    return { r, requests, sources, state, hash: hash(state) };
  }
  private async memoPosition(
    m: EntityManager,
    p: Actor,
    s: IntegrationScope,
    id: string,
    expected?: string,
    current = false,
    asOf: string | null = null,
  ) {
    const b = await this.billing.verifiedReference(
        m,
        p,
        s,
        id,
        expected,
        current,
      ),
      rows = await this.requests(
        m,
        p,
        s,
        'economic_root',
        b.economic_root,
        asOf,
      ),
      t = this.totals(rows);
    if (
      asOf &&
      new Date(b.created_at).getTime() >=
        Date.parse(asOf + 'T00:00:00Z') + 86400000
    )
      conflict(
        'The requested as-of date predates captured billing evidence; no historical balance is inferred.',
      );
    const approvedTerms = rows.find(
      (r) =>
        r.kind === 'TERMS' &&
        r.memo_id === id &&
        r.decision === 'REVIEWED_INACTIVE',
    );
    if (approvedTerms) {
      const proof = approvedTerms.subject.evidence;
      const snap = normalizeReceivableEvidence(proof.rawSnapshot);
      await this.evidence(
        m,
        p,
        s,
        proof.inboxId,
        proof.rawSnapshot,
        snap,
        proof.deliveryId,
      );
    }
    const [head] = await m.query(
      "SELECT max(source_revision)::integer AS revision FROM finance_source_event_previews WHERE tenant_id=$1 AND economic_root=$2 AND ($3::date IS NULL OR created_at<(($3::date+1)::timestamp AT TIME ZONE 'UTC'))",
      [p.tenantId, b.economic_root, asOf],
    );
    return {
      b,
      rows,
      terms: approvedTerms,
      dueDate: approvedTerms?.due_date ?? null,
      headRevision: head.revision,
      sourceCurrent: head.revision === b.source_revision,
      assigned: t.net,
      pending: t.pending,
      remaining: controlUnits(b.total) - t.net,
      available: controlUnits(b.total) - t.net - t.pending,
    };
  }
  private linked(r: Row, b: Row) {
    const snap = b.subject.snapshot;
    if (
      r.source_company_id !== b.source_company_id ||
      r.customer_id !== snap.customerId ||
      r.currency !== b.currency ||
      r.decimal_scale !== b.decimal_scale
    )
      conflict(
        'Receipt owner, customer, currency and scale must match the exact billing reference.',
      );
  }
  private async prepare(
    p: Actor,
    s: IntegrationScope,
    input: ProfileRef & {
      commandKey: string;
      kind: 'TERMS' | 'ALLOCATE' | 'REVERSE';
      receiptId: string | null;
      memoId: string;
      memoHash: string;
      originalId: string | null;
      amount: string;
      dueDate: string | null;
      evidence: Row | null;
    },
    reason: string,
  ) {
    p = identity(p);
    s = integrationScope(s);
    input = detached(input);
    const ref = this.ref(input);
    if (!candidateText(input.commandKey))
      throw new BadRequestException('An exact command key is required.');
    const memoId = controlUuid(input.memoId),
      memoHash = controlHash(input.memoHash),
      receiptId =
        input.receiptId === null ? null : controlUuid(input.receiptId),
      originalId =
        input.originalId === null ? null : controlUuid(input.originalId);
    return this.command(p, s, 'PREPARE_ASSIGNMENT', reason, async (m, g) => {
      const policy = await this.profile(m, p, s, ref),
        position = await this.memoPosition(
          m,
          p,
          s,
          memoId,
          memoHash,
          input.kind !== 'REVERSE',
        ),
        b = position.b;
      const amount = candidateAmount(input.amount, b.decimal_scale);
      if ((input.kind === 'TERMS') !== (amount.units === 0n))
        throw new BadRequestException(
          'A positive exact assignment amount is required.',
        );
      if (input.kind === 'TERMS') {
        const proof = input.evidence!,
          terms = normalizeReceivableEvidence(proof.rawSnapshot);
        const accepted = await this.evidence(
          m,
          p,
          s,
          proof.inboxId,
          proof.rawSnapshot,
          terms,
          proof.deliveryId,
        );
        proof.deliveryId = accepted.delivery_id;
      }
      const subject = {
        schema: 'FINANCE_RECEIVABLE_REQUEST_V1',
        tenantId: p.tenantId,
        ...s,
        commandKey: input.commandKey,
        kind: input.kind,
        receiptId,
        memoId,
        memoHash,
        originalId,
        amount: amount.stored,
        currency: b.currency,
        decimalScale: b.decimal_scale,
        dueDate: input.dueDate,
        profileId: ref.profileId,
        profileHash: ref.profileHash,
        maker: this.maker(p, g),
        evidence: input.evidence,
        accountingState: 'HELD_INACTIVE',
        dischargeState: 'LEGAL_DISCHARGE_HELD',
        financialEffects: 0,
      };
      const [old] = await m.query(
        'SELECT * FROM finance_receivable_requests WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND command_key=$4',
        [p.tenantId, s.legalEntityId, s.bookId, input.commandKey],
      );
      if (old) {
        if (
          old.subject_hash !== hash(subject) ||
          hash(old.subject) !== old.subject_hash
        )
          conflict(
            'The command key already has different frozen assignment content.',
          );
        return this.result(old, true);
      }
      if (input.kind === 'TERMS') {
        const ev = input.evidence!;
        const terms = normalizeReceivableEvidence(ev.rawSnapshot);
        if (
          terms.kind !== 'BILLING_DUE_DATE' ||
          terms.memoId !== memoId ||
          terms.memoHash !== memoHash ||
          terms.invoiceId !== b.subject.snapshot.invoiceId ||
          terms.customerId !== b.subject.snapshot.customerId ||
          terms.currency !== b.currency ||
          terms.decimalScale !== b.decimal_scale ||
          terms.sourceCompanyId !== b.source_company_id ||
          terms.dueDate !== input.dueDate
        )
          conflict(
            'Due-date evidence must bind the exact invoice and reviewed billing subject.',
          );
        await this.evidence(
          m,
          p,
          s,
          ev.inboxId,
          ev.rawSnapshot,
          terms,
          ev.deliveryId,
        );
        if (
          position.rows.some((r) => r.kind === 'TERMS' && r.memo_id === memoId)
        )
          conflict(
            'Terms already exist for this billing revision; use a source correction and new billing revision.',
          );
      } else {
        const cash = await this.receiptPosition(m, p, s, receiptId!);
        this.linked(cash.r, b);
        this.owner(policy, cash.r.subject.snapshot);
        if (input.kind === 'ALLOCATE') {
          if (
            !['ISSUED', 'PARTIALLY_PAID'].includes(
              b.subject.snapshot.sourceStatus,
            )
          )
            conflict(
              'Only an observed open billing status can receive a new inactive assignment.',
            );
          if (
            cash.state.sourceConflicts ||
            cash.state.billingLineageHolds ||
            controlUnitsSigned(cash.state.available) < amount.units ||
            position.available < amount.units
          )
            conflict(
              'Receipt or billing availability is insufficient, conflicted or over-assigned; no balance is clamped.',
            );
        } else {
          const original = cash.requests.find((r) => r.id === originalId);
          if (
            !original ||
            original.kind !== 'ALLOCATE' ||
            original.decision !== 'REVIEWED_INACTIVE' ||
            original.memo_id !== memoId
          )
            conflict(
              'An original reviewed assignment is required for unassignment.',
            );
          const reserved = cash.requests
            .filter(
              (r) =>
                r.original_id === originalId &&
                r.decision !== 'REJECTED_INACTIVE',
            )
            .reduce((n, r) => n + controlUnits(r.amount), 0n);
          const refundReserved = await this.refundReservations(m, original.id);
          if (
            reserved + refundReserved + amount.units >
            controlUnits(original.amount)
          )
            conflict(
              'Partial or pending reversals exceed the original assignment.',
            );
        }
      }
      const row = {
        id: randomUUID(),
        ...this.scope(p, s),
        command_key: input.commandKey,
        kind: input.kind,
        receipt_id: receiptId,
        memo_id: memoId,
        original_id: originalId,
        amount: amount.stored,
        currency: b.currency,
        decimal_scale: b.decimal_scale,
        due_date: input.dueDate,
        profile_id: ref.profileId,
        profile_hash: ref.profileHash,
        subject,
        subject_hash: hash(subject),
        maker_subject_id: p.subjectId,
        maker_natural_person_id: p.naturalPersonId,
        maker_grant_id: g.id,
        maker_grant_hash: g.hash,
      };
      await this.insert(m, 'finance_receivable_requests', row);
      await this.audit(m, p, s, 'REQUEST', row, 'PREPARED_INACTIVE', reason);
      await this.profile(m, p, s, ref);
      return this.result(row);
    });
  }
  async prepareTerms(
    p: Actor,
    s: IntegrationScope,
    input: ProfileRef & {
      commandKey: string;
      inboxId: string;
      snapshot: unknown;
    },
    reason: string,
  ) {
    input = detached(input);
    const terms = normalizeReceivableEvidence(input.snapshot);
    if (terms.kind !== 'BILLING_DUE_DATE')
      throw new BadRequestException('Signed due-date evidence is required.');
    return this.prepare(
      p,
      s,
      {
        ...this.ref(input),
        commandKey: input.commandKey,
        kind: 'TERMS',
        receiptId: null,
        memoId: terms.memoId,
        memoHash: terms.memoHash,
        originalId: null,
        amount: '0',
        dueDate: terms.dueDate,
        evidence: {
          inboxId: controlUuid(input.inboxId),
          deliveryId: null,
          rawSnapshot: input.snapshot,
        },
      },
      reason,
    );
  }
  async proposeAssignment(
    p: Actor,
    s: IntegrationScope,
    input: ProfileRef & {
      commandKey: string;
      receiptId: string;
      memoId: string;
      memoHash: string;
      amount: string;
      originalId?: string;
    },
    reason: string,
  ) {
    const captured = detached(input),
      originalId =
        captured.originalId === undefined
          ? null
          : controlUuid(captured.originalId);
    return this.prepare(
      p,
      s,
      {
        ...captured,
        kind: originalId === null ? 'ALLOCATE' : 'REVERSE',
        originalId,
        dueDate: null,
        evidence: null,
      },
      reason,
    );
  }
  async reviewInactive(
    p: Actor,
    s: IntegrationScope,
    ref: { id: string; hash: string },
    decision: 'REVIEWED_INACTIVE' | 'REJECTED_INACTIVE',
    reason: string,
  ) {
    p = identity(p);
    s = integrationScope(s);
    ref = { id: controlUuid(ref.id), hash: controlHash(ref.hash) };
    if (!['REVIEWED_INACTIVE', 'REJECTED_INACTIVE'].includes(decision))
      throw new BadRequestException(
        'An explicit inactive decision is required.',
      );
    return this.command(p, s, 'REVIEW_ASSIGNMENT', reason, async (m, g) => {
      const [r] = await m.query(
        'SELECT * FROM finance_receivable_requests WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND id=$4',
        [p.tenantId, s.legalEntityId, s.bookId, ref.id],
      );
      if (!r)
        throw new ForbiddenException(
          'Assignment request unavailable in this scope.',
        );
      if (r.subject_hash !== ref.hash || hash(r.subject) !== r.subject_hash)
        conflict('The exact frozen assignment subject differs.');
      if (
        r.maker_subject_id === p.subjectId ||
        r.maker_natural_person_id === p.naturalPersonId
      )
        throw new ForbiddenException(
          'An independent natural person must review the assignment.',
        );
      const [old] = await m.query(
        'SELECT * FROM finance_receivable_decisions WHERE request_id=$1',
        [r.id],
      );
      if (old) {
        if (
          old.reviewer_subject_id !== p.subjectId ||
          old.reviewer_natural_person_id !== p.naturalPersonId ||
          old.decision !== decision ||
          hash(old.subject) !== old.subject_hash
        )
          conflict('The immutable review already records another decision.');
        return { ...this.result(r, true), decisionId: old.id, decision };
      }
      let maker:
        | Awaited<ReturnType<FinanceReceivablesService['grant']>>
        | undefined;
      if (decision === 'REVIEWED_INACTIVE') {
        maker = await this.grant(
          m,
          {
            kind: 'USER',
            tenantId: p.tenantId,
            subjectId: r.maker_subject_id,
            naturalPersonId: r.maker_natural_person_id,
          },
          s,
          'PREPARE_ASSIGNMENT',
        );
        if (maker.id !== r.maker_grant_id || maker.hash !== r.maker_grant_hash)
          conflict('Frozen assignment maker authority differs.');
        const policy = await this.profile(m, p, s, {
            profileId: r.profile_id,
            profileHash: r.profile_hash,
          }),
          b = await this.memoPosition(
            m,
            p,
            s,
            r.memo_id,
            r.subject.memoHash,
            r.kind !== 'REVERSE',
          );
        if (r.kind === 'TERMS') {
          const e = r.subject.evidence,
            t = normalizeReceivableEvidence(e.rawSnapshot);
          await this.evidence(
            m,
            p,
            s,
            e.inboxId,
            e.rawSnapshot,
            t,
            e.deliveryId,
          );
        } else {
          const cash = await this.receiptPosition(m, p, s, r.receipt_id);
          this.linked(cash.r, b.b);
          this.owner(policy, cash.r.subject.snapshot);
          if (
            r.kind === 'ALLOCATE' &&
            (cash.state.sourceConflicts ||
              cash.state.billingLineageHolds ||
              controlUnitsSigned(cash.state.available) < 0n ||
              b.available < 0n)
          )
            conflict(
              'Assignment must remain within exact unconflicted capacity.',
            );
        }
      }
      const subject = {
          schema: 'FINANCE_RECEIVABLE_DECISION_V1',
          requestId: r.id,
          requestHash: r.subject_hash,
          decision,
          reviewer: this.maker(p, g),
        },
        row = {
          id: randomUUID(),
          ...this.scope(p, s),
          request_id: r.id,
          decision,
          subject,
          subject_hash: hash(subject),
          reviewer_subject_id: p.subjectId,
          reviewer_natural_person_id: p.naturalPersonId,
          reviewer_grant_id: g.id,
        };
      await this.insert(m, 'finance_receivable_decisions', row);
      await this.audit(m, p, s, 'DECISION', row, decision, reason);
      if (maker) {
        await maker.verify();
        await this.profile(m, p, s, {
          profileId: r.profile_id,
          profileHash: r.profile_hash,
        });
      }
      return { ...this.result(r), decisionId: row.id, decision };
    });
  }
  async readReceipt(p: Actor, s: IntegrationScope, id: string) {
    p = identity(p);
    s = integrationScope(s);
    id = controlUuid(id);
    return this.source.transaction('REPEATABLE READ', async (m) => {
      await m.query('SET TRANSACTION READ ONLY');
      await integrationBook(
        m,
        { kind: 'WORKER', tenantId: p.tenantId, subjectId: p.subjectId },
        s,
        false,
      );
      const g = await this.grant(m, p, s, 'READ_RECEIVABLES', false),
        pos = await this.receiptPosition(m, p, s, id);
      const reviews: Row[] = await m.query(
        'SELECT * FROM finance_receivable_reconciliations WHERE receipt_id=$1 ORDER BY created_at,id',
        [id],
      );
      for (const r of reviews)
        if (
          hash(r.subject) !== r.subject_hash ||
          r.subject.state !== r.state ||
          r.subject.positionHash !== r.position_hash
        )
          conflict('Stored reconciliation evidence differs.');
      await g.verify();
      return {
        ...pos.state,
        hash: pos.hash,
        reconciliations: reviews.map((r) => ({
          id: r.id,
          state: r.state,
          positionHash: r.position_hash,
          hash: r.subject_hash,
          stale: r.position_hash !== pos.hash,
        })),
        holds: [
          ...RECEIVABLE_HOLDS,
          ...(controlUnitsSigned(pos.state.available) < 0n
            ? ['NEGATIVE_CAPACITY_RECONCILIATION_REQUIRED']
            : []),
        ],
      };
    });
  }
  /** Transaction-local B18 cash evidence; the caller enforces its own exact scoped authority. */
  async verifiedReceipt(
    m: EntityManager,
    p: Actor,
    s: IntegrationScope,
    ref: { id: string; hash: string },
  ) {
    const pos = await this.receiptPosition(m, p, s, controlUuid(ref.id));
    if (pos.r.subject_hash !== controlHash(ref.hash))
      conflict('Exact source receipt hash required.');
    return {
      receipt: pos.r,
      available: pos.state.available,
      sourceConflicts: pos.state.sourceConflicts,
      billingLineageHolds: pos.state.billingLineageHolds,
    };
  }
  private async claimRecoveryReservations(
    m: EntityManager,
    id: string,
  ): Promise<bigint> {
    const [{ present }] = await m.query(
      "SELECT to_regprocedure('finance_claim_receipt_reserved(uuid)') IS NOT NULL present",
    );
    if (!present) return 0n;
    const [{ reserved }] = await m.query(
      'SELECT finance_claim_receipt_reserved($1)::numeric(38,12)::text reserved',
      [id],
    );
    return controlUnitsSigned(reserved);
  }
  /** Transaction-local B16 reference; the caller must enforce its scoped authority. */
  async verifiedAssignment(
    m: EntityManager,
    p: Actor,
    s: IntegrationScope,
    ref: { id: string; hash: string },
  ) {
    const [r] = await m.query(
      "SELECT * FROM finance_receivable_requests WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND id=$4 AND subject_hash=$5 AND kind='ALLOCATE'",
      [
        p.tenantId,
        s.legalEntityId,
        s.bookId,
        controlUuid(ref.id),
        controlHash(ref.hash),
      ],
    );
    if (!r)
      throw new ForbiddenException(
        'The exact original receipt assignment is unavailable.',
      );
    const receipt = await this.receiptPosition(m, p, s, r.receipt_id),
      assignment = receipt.requests.find((a) => a.id === r.id);
    if (!assignment || assignment.decision !== 'REVIEWED_INACTIVE')
      conflict(
        'Refunds require an independently reviewed original assignment.',
      );
    const billing = await this.billing.verifiedReference(
      m,
      p,
      s,
      r.memo_id,
      r.subject.memoHash,
      false,
    );
    const reversed = receipt.requests
      .filter(
        (a) => a.original_id === r.id && a.decision !== 'REJECTED_INACTIVE',
      )
      .reduce((n, a) => n + controlUnits(a.amount), 0n);
    return {
      assignment,
      receipt: receipt.r,
      billing,
      sourceConflicts: receipt.state.sourceConflicts,
      billingLineageHolds: receipt.state.billingLineageHolds,
      remainingAfterReversals: controlAmount(controlUnits(r.amount) - reversed),
      refundReserved: controlAmount(await this.refundReservations(m, r.id)),
    };
  }
  private async refundReservations(
    m: EntityManager,
    assignmentId: string,
  ): Promise<bigint> {
    const [{ present }] = await m.query(
      "SELECT to_regprocedure('finance_policy_refund_reserved(uuid)') IS NOT NULL present",
    );
    if (!present) return 0n;
    const [{ reserved }] = await m.query(
      'SELECT finance_policy_refund_reserved($1::uuid)::numeric(38,12)::text reserved',
      [assignmentId],
    );
    return controlUnitsSigned(
      reserved.includes('.') ? reserved : reserved + '.000000000000',
    );
  }
  async readBillingAgeing(
    p: Actor,
    s: IntegrationScope,
    input: ProfileRef & { memoId: string; asOf: string },
  ) {
    p = identity(p);
    s = integrationScope(s);
    input = detached(input);
    const ref = this.ref(input),
      id = controlUuid(input.memoId),
      asOf = controlDate(input.asOf);
    return this.source.transaction('REPEATABLE READ', async (m) => {
      await m.query('SET TRANSACTION READ ONLY');
      await integrationBook(
        m,
        { kind: 'WORKER', tenantId: p.tenantId, subjectId: p.subjectId },
        s,
        false,
      );
      const g = await this.grant(m, p, s, 'READ_RECEIVABLES', false);
      // Profile reads use no write lock in a read-only transaction.
      const [release] = await m.query(
        "SELECT * FROM finance_configuration_releases WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND id=$4 AND release_hash=$5 AND kind='RECEIVABLE_CONTROLS' AND state='REVIEWED_INACTIVE' AND effective_from<=$6::date AND (effective_to IS NULL OR effective_to>$6::date)",
        [
          p.tenantId,
          s.legalEntityId,
          s.bookId,
          ref.profileId,
          ref.profileHash,
          asOf,
        ],
      );
      if (!release)
        conflict(
          'An exact inactive ageing profile is required for the as-of date.',
        );
      const policy = receivableProfile(
          release.payload,
          release.dependency_refs,
        ),
        b = await this.memoPosition(m, p, s, id, undefined, false, asOf);
      await g.verify();
      return {
        memoId: id,
        currency: b.b.currency,
        decimalScale: b.b.decimal_scale,
        sourceCurrent: b.sourceCurrent,
        observedTotal: b.b.total,
        assigned: controlAmount(b.assigned),
        pending: controlAmount(b.pending),
        remaining: controlAmount(b.remaining),
        available: controlAmount(b.available),
        ...dueAgeing(asOf, b.dueDate, policy.ageingBands),
        asOf,
        balanceCutoff: 'CAPTURED_EVENTS_THROUGH_UTC_DAY_END',
        accountingState: 'HELD_INACTIVE',
        legalReceivableScope: 'UNASSIGNED_HELD',
        financialEffects: 0,
        holds: [
          ...RECEIVABLE_HOLDS,
          ...(b.remaining < 0n ? ['SOURCE_REDUCTION_OVERASSIGNMENT'] : []),
        ],
      };
    });
  }
  async reconcile(
    p: Actor,
    s: IntegrationScope,
    input: {
      commandKey: string;
      receiptId: string;
      positionHash: string;
      statementHash: string;
      received: string;
      bankSettled: string;
      bankFee: string;
    },
    reason: string,
  ) {
    p = identity(p);
    s = integrationScope(s);
    input = detached(input);
    const id = controlUuid(input.receiptId);
    controlHash(input.positionHash);
    controlHash(input.statementHash);
    if (!candidateText(input.commandKey))
      throw new BadRequestException(
        'An exact reconciliation command key is required.',
      );
    return this.command(p, s, 'RECONCILE_RECEIPT', reason, async (m, g) => {
      const [old] = await m.query(
        'SELECT * FROM finance_receivable_reconciliations WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND command_key=$4',
        [p.tenantId, s.legalEntityId, s.bookId, input.commandKey],
      );
      if (old) {
        if (
          hash(old.subject) !== old.subject_hash ||
          hash(old.subject.input) !== hash(input) ||
          old.reviewer_subject_id !== p.subjectId ||
          old.reviewer_natural_person_id !== p.naturalPersonId
        )
          conflict('Reconciliation command content differs.');
        return {
          ...this.result(old, true),
          state: old.state,
          positionHash: old.position_hash,
        };
      }
      const pos = await this.receiptPosition(m, p, s, id);
      if (pos.hash !== input.positionHash)
        conflict(
          'Receipt position changed; a new independent reconciliation is required.',
        );
      const creator = pos.r.subject.proof.maker;
      if (
        creator.subjectId === p.subjectId ||
        creator.naturalPersonId === p.naturalPersonId ||
        pos.sources.some(
          (r) =>
            r.maker_subject_id === p.subjectId ||
            r.maker_natural_person_id === p.naturalPersonId,
        ) ||
        pos.requests.some(
          (r) =>
            r.maker_subject_id === p.subjectId ||
            r.maker_natural_person_id === p.naturalPersonId,
        )
      )
        throw new ForbiddenException(
          'Receipt and assignment preparers cannot reconcile their own work.',
        );
      const observed = {
        received: candidateAmount(input.received, pos.r.decimal_scale).stored,
        bankSettled: candidateAmount(input.bankSettled, pos.r.decimal_scale)
          .stored,
        bankFee: candidateAmount(input.bankFee, pos.r.decimal_scale).stored,
      };
      const matched =
        observed.received === pos.r.received &&
        observed.bankSettled === pos.r.bank_settled &&
        observed.bankFee === pos.r.bank_fee &&
        controlUnits(observed.received) ===
          controlUnits(observed.bankSettled) + controlUnits(observed.bankFee) &&
        !pos.state.sourceConflicts &&
        !pos.state.billingLineageHolds &&
        controlUnitsSigned(pos.state.available) >= 0n;
      const state = matched ? 'MATCHED_HELD' : 'EXCEPTION_HELD',
        subject = {
          schema: 'FINANCE_RECEIPT_RECONCILIATION_V1',
          input,
          position: pos.state,
          positionHash: pos.hash,
          state,
          reviewer: this.maker(p, g),
          accountingState: 'HELD_INACTIVE',
          dischargeState: 'LEGAL_DISCHARGE_HELD',
          financialEffects: 0,
        };
      const row = {
        id: randomUUID(),
        ...this.scope(p, s),
        receipt_id: id,
        command_key: input.commandKey,
        position_hash: pos.hash,
        state,
        subject,
        subject_hash: hash(subject),
        reviewer_subject_id: p.subjectId,
        reviewer_natural_person_id: p.naturalPersonId,
        reviewer_grant_id: g.id,
      };
      await this.insert(m, 'finance_receivable_reconciliations', row);
      await this.audit(m, p, s, 'RECONCILIATION', row, state, reason);
      return { ...this.result(row), state, positionHash: pos.hash };
    });
  }
}
function controlUnitsSigned(value: string) {
  // Derived sums can exceed the storage bound of an individual component.
  if (!/^-?(0|[1-9]\d*)\.\d{12}$/.test(value))
    throw new BadRequestException(
      'A canonical derived control amount is required.',
    );
  return BigInt(value.replace('.', ''));
}
