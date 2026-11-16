import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
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
  integrationBook,
  integrationScope,
  integrationSnapshot,
} from './finance-integration.controls';
import type { IntegrationScope } from './finance-integration.types';
import {
  controlAmount as decimal,
  controlHash,
  controlUnits as units,
  controlUuid,
  receivableProfile,
} from './finance-receivables.types';
import { verifyAcceptedSource } from './finance-accepted-source';
import {
  cashAmount,
  cashEconomicKey,
  cashEvidenceVector,
  cashObject,
  cashText,
  normalizeCashEvidence,
  normalizeCashOutcome,
  normalizePaymentPlan,
  OUTGOING_EVENT,
  OUTGOING_HOLDS,
  OUTGOING_SIMULATORS,
  type BankPaymentEvidence,
  type CashPermission,
  type CashProviderOutcome,
  type CashProviderRequest,
  type CashSimulationAdapter,
  type FundingEvidence,
  type ObligationEvidence,
} from './finance-outgoing.types';

type Row = Record<string, any>;
type Actor = FinanceConfigurationActor;
interface Ref {
  id: string;
  hash: string;
}
interface Profile {
  profileId: string;
  profileHash: string;
}
const fail = (message: string): never => {
  throw new ConflictException(message);
};

/** Internal inactive controls. No real transport, legacy cash writer or journal service is injected. */
@Injectable()
export class FinanceOutgoingService {
  constructor(
    @InjectDataSource() private readonly source: DataSource,
    @Inject(OUTGOING_SIMULATORS)
    private readonly simulators: readonly CashSimulationAdapter[],
  ) {}
  private ids(p: Actor, s: IntegrationScope) {
    return [p.tenantId, s.legalEntityId, s.bookId];
  }
  private identity(p: Actor): Actor {
    if (p?.kind !== 'USER')
      throw new ForbiddenException(
        'A trusted outgoing-cash human identity is required.',
      );
    return Object.freeze({
      kind: 'USER',
      tenantId: controlUuid(p.tenantId),
      subjectId: controlUuid(p.subjectId),
      naturalPersonId: controlUuid(p.naturalPersonId),
    });
  }
  private async authority(
    m: EntityManager,
    p: Actor,
    s: IntegrationScope,
    permission: CashPermission,
    currency: string,
    amount = '0',
  ) {
    const rows = await m.query(
      `SELECT * FROM finance_outgoing_authorities WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND subject_id=$4 AND natural_person_id=$5 AND permission=$6 AND currency=$7 AND max_amount>=$8::numeric AND state='ENABLED' AND revoked_at IS NULL AND valid_from<=statement_timestamp() AND valid_to>statement_timestamp() FOR SHARE`,
      [
        ...this.ids(p, s),
        p.subjectId,
        p.naturalPersonId,
        permission,
        currency,
        amount,
      ],
    );
    if (rows.length !== 1)
      throw new ForbiddenException(
        'A unique current scoped outgoing-cash authority within its currency/amount limit is required.',
      );
    return rows[0] as Row;
  }
  private async command<T>(
    actor: Actor,
    selection: IntegrationScope,
    permission: CashPermission,
    currency: string,
    amount: string,
    reason: string,
    work: (
      m: EntityManager,
      p: Actor,
      s: IntegrationScope,
      g: Row,
    ) => Promise<T>,
  ): Promise<T> {
    const p = this.identity(actor),
      s = integrationScope(selection);
    cashText(reason, 2000);
    return this.source.transaction(async (m) => {
      // Same ordering as B14/B11; account and obligation capacity cannot be spent by concurrent commands.
      await m.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        'finance-inactive-config:' + p.tenantId,
      ]);
      await integrationBook(
        m,
        { kind: 'WORKER', tenantId: p.tenantId, subjectId: p.subjectId },
        s,
      );
      const g = await this.authority(m, p, s, permission, currency, amount),
        fingerprint = hash(integrationSnapshot(g));
      const result = await work(m, p, s, g),
        current = await this.authority(m, p, s, permission, currency, amount);
      if (hash(integrationSnapshot(current)) !== fingerprint)
        throw new ForbiddenException(
          'Outgoing-cash authority changed before completion.',
        );
      return result;
    });
  }
  private async insert(
    m: EntityManager,
    table: string,
    row: Row,
    p: Actor,
    s: IntegrationScope,
    action: string,
    reason: string,
  ) {
    const keys = Object.keys(row);
    await m.query(
      `INSERT INTO ${table}(${keys.join(',')}) VALUES(${keys.map((_, i) => '$' + (i + 1)).join(',')})`,
      Object.values(row),
    );
    await m.query(
      'INSERT INTO finance_outgoing_audits(tenant_id,legal_entity_id,book_id,object_table,object_id,action,subject_hash,actor_subject_id,actor_natural_person_id,reason) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
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
  private async row(
    m: EntityManager,
    p: Actor,
    s: IntegrationScope,
    table: string,
    id: string,
    expected?: string,
  ): Promise<Row> {
    const [row] = await m.query(
      `SELECT * FROM ${table} WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND id=$4 FOR SHARE`,
      [...this.ids(p, s), controlUuid(id)],
    );
    if (
      !row ||
      (expected !== undefined && row.subject_hash !== controlHash(expected))
    )
      throw new ForbiddenException(
        'Exact outgoing-cash evidence is unavailable in this book.',
      );
    if (
      hash(row.subject) !== row.subject_hash ||
      canonicalFinanceJson(row.subject) !== row.canonical_subject
    )
      fail('Outgoing-cash evidence hash differs.');
    return row;
  }
  private result(row: Row, reused = false) {
    return {
      id: row.id,
      hash: row.subject_hash,
      reused,
      accountingState: 'HELD_INACTIVE',
      dischargeState: 'LEGAL_DISCHARGE_HELD',
      financialEffects: 0,
      holds: [...OUTGOING_HOLDS],
    };
  }
  private async ownedProfile(
    m: EntityManager,
    p: Actor,
    s: IntegrationScope,
    ref: Profile,
    snapshot: Row,
  ) {
    const [r] = await m.query(
      "SELECT * FROM finance_configuration_releases WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND id=$4 AND release_hash=$5 AND kind='RECEIVABLE_CONTROLS' AND state='REVIEWED_INACTIVE' AND effective_from<=(statement_timestamp() AT TIME ZONE 'UTC')::date AND (effective_to IS NULL OR effective_to>(statement_timestamp() AT TIME ZONE 'UTC')::date) FOR SHARE",
      [
        ...this.ids(p, s),
        controlUuid(ref.profileId),
        controlHash(ref.profileHash),
      ],
    );
    if (!r)
      fail(
        'An exact current reviewed inactive cash ownership profile is required.',
      );
    const profile = receivableProfile(r.payload, r.dependency_refs);
    if (
      !profile.cashAccounts.some(
        (a) =>
          a.sourceCompanyId === snapshot.sourceCompanyId &&
          a.sourceAccountId === snapshot.sourceAccountId &&
          a.currency === snapshot.currency &&
          a.decimalScale === snapshot.decimalScale,
      )
    )
      fail(
        'Outgoing source company, account, currency or scale is outside the reviewed ownership profile.',
      );
  }
  async observeEvidence(
    actor: Actor,
    scope: IntegrationScope,
    input: Profile & { inboxId: string; snapshot: unknown },
    reason: string,
  ) {
    const raw = cashObject(input.snapshot),
      snapshot = normalizeCashEvidence(raw);
    return this.command(
      actor,
      scope,
      'OBSERVE_CASH',
      snapshot.currency,
      '0',
      reason,
      async (m, p, s, g) => {
        await this.ownedProfile(m, p, s, input, snapshot);
        await verifyAcceptedSource(m, p, s, controlUuid(input.inboxId), {
          eventType: OUTGOING_EVENT,
          factKind: 'OUTGOING_EVIDENCE',
          aggregateType: 'OUTGOING_EVIDENCE',
          aggregateId: snapshot.id,
          companyId: snapshot.sourceCompanyId,
          revision: 1,
          snapshotHash: hash(raw),
        });
        const key = cashEconomicKey(snapshot),
          vector = cashEvidenceVector(snapshot);
        const [old] = await m.query(
          'SELECT * FROM finance_outgoing_evidence WHERE tenant_id=$1 AND economic_key=$2 FOR SHARE',
          [p.tenantId, key],
        );
        if (
          old &&
          (old.legal_entity_id !== s.legalEntityId || old.book_id !== s.bookId)
        )
          throw new ForbiddenException(
            'The cash economic identity already belongs to another accounting book.',
          );
        const sourceState =
          old && old.vector_hash !== vector ? 'CONFLICT_HELD' : 'MATCHED';
        const [alias] = await m.query(
          'SELECT * FROM finance_outgoing_aliases WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND inbox_id=$4',
          [...this.ids(p, s), input.inboxId],
        );
        if (alias) {
          if (alias.subject.rawSnapshotHash !== hash(raw))
            fail('An inbox delivery cannot change its cash evidence.');
          return {
            ...this.result(
              await this.row(
                m,
                p,
                s,
                'finance_outgoing_evidence',
                alias.evidence_id,
              ),
              true,
            ),
            sourceState: alias.state,
          };
        }
        const evidence = old ?? {
          id: randomUUID(),
          ...this.scope(p, s),
          kind: snapshot.kind,
          source_company_id: snapshot.sourceCompanyId,
          source_account_id: snapshot.sourceAccountId,
          currency: snapshot.currency,
          decimal_scale: snapshot.decimalScale,
          economic_key: key,
          vector_hash: vector,
          profile_id: input.profileId,
          profile_hash: input.profileHash,
          inbox_id: input.inboxId,
          ...this.content({
            schema: 'FINANCE_OUTGOING_SOURCE_V1',
            purpose: 'INACTIVE_CONTROLS_ONLY',
            snapshot,
            rawSnapshotHash: hash(raw),
          }),
          ...this.actor(p, g),
        };
        if (!old)
          await this.insert(
            m,
            'finance_outgoing_evidence',
            evidence,
            p,
            s,
            'OBSERVE',
            reason,
          );
        const link = {
          id: randomUUID(),
          ...this.scope(p, s),
          evidence_id: evidence.id,
          inbox_id: input.inboxId,
          state: sourceState,
          ...this.content({
            evidenceId: evidence.id,
            evidenceHash: evidence.subject_hash,
            rawSnapshotHash: hash(raw),
            incomingSnapshot: snapshot,
            sourceState,
          }),
          ...this.actor(p, g),
        };
        await this.insert(
          m,
          'finance_outgoing_aliases',
          link,
          p,
          s,
          'LINK_SOURCE',
          reason,
        );
        return { ...this.result(evidence, Boolean(old)), sourceState };
      },
    );
  }
  async prepare(
    actor: Actor,
    scope: IntegrationScope,
    value: unknown,
    reason: string,
  ) {
    const raw: any = cashObject(value);
    // Currency/precision are obtained from owned evidence, never trusted from a payment request.
    const p = this.identity(actor),
      s = integrationScope(scope);
    const preview = await this.source.transaction((m) =>
      this.row(
        m,
        p,
        s,
        'finance_outgoing_evidence',
        raw.fundingId,
        raw.fundingHash,
      ),
    );
    const plan = normalizePaymentPlan(raw, preview.decimal_scale);
    return this.command(
      p,
      s,
      'PREPARE_PAYMENT',
      preview.currency,
      decimal(units(plan.amount) + units(plan.maximumFee)),
      reason,
      async (m, p, s, g) => {
        const funding = await this.row(
            m,
            p,
            s,
            'finance_outgoing_evidence',
            plan.fundingId,
            plan.fundingHash,
          ),
          obligation = await this.row(
            m,
            p,
            s,
            'finance_outgoing_evidence',
            plan.obligationId,
            plan.obligationHash,
          ),
          f: FundingEvidence = funding.subject.snapshot,
          o: ObligationEvidence = obligation.subject.snapshot;
        if (
          f.kind !== 'FUNDING' ||
          o.kind !== 'OBLIGATION' ||
          f.sourceCompanyId !== o.sourceCompanyId ||
          f.sourceAccountId !== o.sourceAccountId ||
          f.currency !== o.currency ||
          f.decimalScale !== o.decimalScale ||
          hash(o.beneficiary) !== plan.beneficiaryHash ||
          units(plan.amount) > units(o.amount)
        )
          fail(
            'Frozen obligation, beneficiary, funding ownership or currency differs.',
          );
        await this.ownedProfile(
          m,
          p,
          s,
          { profileId: funding.profile_id, profileHash: funding.profile_hash },
          f,
        );
        const [time] = await m.query('SELECT statement_timestamp() now');
        if (
          Date.parse(plan.expiresAt) <= time.now.getTime() ||
          Date.parse(plan.expiresAt) > new Date(g.valid_to).getTime()
        )
          fail(
            'Payment approval expiry must be future and within the preparer mandate.',
          );
        const subject = {
          schema: 'FINANCE_OUTGOING_INTENT_V1',
          purpose: 'INACTIVE_CONTROLS_ONLY',
          scope: { tenantId: p.tenantId, ...s },
          plan,
          beneficiary: o.beneficiary,
          providerCode: f.providerCode,
          providerAccountReference: f.providerAccountReference,
          makerSubjectId: p.subjectId,
          makerNaturalPersonId: p.naturalPersonId,
          authorityHash: hash(integrationSnapshot(g)),
        };
        const [old] = await m.query(
          'SELECT * FROM finance_outgoing_intents WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND command_key=$4',
          [...this.ids(p, s), plan.commandKey],
        );
        if (old) {
          if (old.subject_hash !== hash(subject))
            fail('A payment command key cannot change its approved subject.');
          return this.result(old, true);
        }
        const id = randomUUID(),
          intent = {
            id,
            ...this.scope(p, s),
            command_key: plan.commandKey,
            funding_id: funding.id,
            obligation_id: obligation.id,
            currency: f.currency,
            decimal_scale: f.decimalScale,
            amount: plan.amount,
            maximum_fee: plan.maximumFee,
            beneficiary_hash: plan.beneficiaryHash,
            execution_key:
              'FNC1-' +
              hash({
                tenantId: p.tenantId,
                sourceCompanyId: f.sourceCompanyId,
                intentId: id,
              }),
            expires_at: new Date(plan.expiresAt),
            ...this.content(subject),
            ...this.actor(p, g),
          };
        await this.insert(
          m,
          'finance_outgoing_intents',
          intent,
          p,
          s,
          'PREPARE',
          reason,
        );
        return this.result(intent);
      },
    );
  }
  private async events(m: EntityManager, intent: Row) {
    return m.query(
      'SELECT * FROM finance_outgoing_events WHERE intent_id=$1 ORDER BY created_at,id',
      [intent.id],
    );
  }
  private async approval(m: EntityManager, intent: Row) {
    const events = await this.events(m, intent),
      decision = events.find((e: Row) => e.action === 'APPROVE');
    if (
      !decision ||
      events.some((e: Row) => e.action === 'REJECT' || e.action === 'CANCEL')
    )
      fail('A current independently approved uncancelled payment is required.');
    const [current] = await m.query(
      "SELECT * FROM finance_outgoing_authorities WHERE id=$1 AND state='ENABLED' AND revoked_at IS NULL AND valid_from<=statement_timestamp() AND valid_to>statement_timestamp() FOR SHARE",
      [decision.authority_id],
    );
    if (
      !current ||
      hash(integrationSnapshot(current)) !== decision.subject.authorityHash
    )
      throw new ForbiddenException(
        'The payment approval authority expired or changed.',
      );
    const [time] = await m.query('SELECT statement_timestamp() now');
    if (new Date(intent.expires_at).getTime() <= time.now.getTime())
      fail('The frozen payment approval expired.');
    return events;
  }
  private async event(
    m: EntityManager,
    p: Actor,
    s: IntegrationScope,
    g: Row,
    intent: Row,
    action: string,
    key: string,
    reason: string,
    details: Row = {},
  ) {
    cashText(key, 150);
    const subject = {
      intentId: intent.id,
      intentHash: intent.subject_hash,
      action,
      commandKey: key,
      details,
      authorityHash: hash(integrationSnapshot(g)),
    };
    const [old] = await m.query(
      'SELECT * FROM finance_outgoing_events WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND command_key=$4',
      [...this.ids(p, s), key],
    );
    if (old) {
      if (old.subject_hash !== hash(subject))
        fail('An outgoing event command key cannot change its subject.');
      return this.result(old, true);
    }
    const row = {
      id: randomUUID(),
      ...this.scope(p, s),
      intent_id: intent.id,
      action,
      command_key: key,
      reason,
      ...this.content(subject),
      ...this.actor(p, g),
    };
    await this.insert(m, 'finance_outgoing_events', row, p, s, action, reason);
    return this.result(row);
  }
  private async selected(actor: Actor, scope: IntegrationScope, ref: Ref) {
    const p = this.identity(actor),
      s = integrationScope(scope);
    return this.source.transaction((m) =>
      this.row(m, p, s, 'finance_outgoing_intents', ref.id, ref.hash),
    );
  }
  async review(
    actor: Actor,
    scope: IntegrationScope,
    ref: Ref,
    decision: 'APPROVE' | 'REJECT',
    commandKey: string,
    reason: string,
  ) {
    if (!['APPROVE', 'REJECT'].includes(decision))
      throw new BadRequestException(
        'Only inactive approval/rejection is supported.',
      );
    const selected = await this.selected(actor, scope, ref);
    return this.command(
      actor,
      scope,
      'REVIEW_PAYMENT',
      selected.currency,
      decimal(units(selected.amount) + units(selected.maximum_fee)),
      reason,
      async (m, p, s, g) => {
        const intent = await this.row(
          m,
          p,
          s,
          'finance_outgoing_intents',
          ref.id,
          ref.hash,
        );
        if (
          intent.actor_subject_id === p.subjectId ||
          intent.actor_natural_person_id === p.naturalPersonId ||
          intent.subject.beneficiary.naturalPersonIds.includes(
            p.naturalPersonId,
          )
        )
          throw new ForbiddenException(
            'Independent payment review excludes maker aliases and beneficiary-related people.',
          );
        const [time] = await m.query('SELECT statement_timestamp() now');
        if (
          new Date(intent.expires_at).getTime() <= time.now.getTime() ||
          new Date(intent.expires_at) > new Date(g.valid_to)
        )
          fail('Payment review must cover the frozen expiry.');
        return this.event(m, p, s, g, intent, decision, commandKey, reason);
      },
    );
  }
  private async position(
    m: EntityManager,
    p: Actor,
    s: IntegrationScope,
    intent: Row,
  ) {
    const events: Row[] = await this.events(m, intent),
      calls: Row[] = await m.query(
        'SELECT * FROM finance_outgoing_calls WHERE intent_id=$1 ORDER BY created_at,id',
        [intent.id],
      ),
      observations: Row[] = await m.query(
        'SELECT * FROM finance_outgoing_observations WHERE intent_id=$1 ORDER BY created_at,id',
        [intent.id],
      );
    const confirmed = observations.filter((o) => o.state === 'CONFIRMED'),
      failed = observations.some((o) => o.state === 'FAILED_FINAL'),
      conflict = observations.some((o) => o.state === 'CONFLICT_HELD');
    const [sourceConflicts] = await m.query(
      "SELECT count(*)::int n FROM finance_outgoing_aliases WHERE evidence_id=ANY($1::uuid[]) AND state='CONFLICT_HELD'",
      [[intent.funding_id, intent.obligation_id]],
    );
    let exception =
        conflict ||
        sourceConflicts.n > 0 ||
        Boolean(confirmed.length && failed),
      paid = 0n;
    const distinct = new Map<string, Row>();
    for (const o of confirmed) {
      const old = distinct.get(o.provider_payment_id);
      if (old && (old.amount !== o.amount || old.fee !== o.fee))
        exception = true;
      if (
        !old ||
        units(o.amount) + units(o.fee) > units(old.amount) + units(old.fee)
      )
        distinct.set(o.provider_payment_id, o);
      if (
        units(o.amount) !== units(intent.amount) ||
        units(o.fee) > units(intent.maximum_fee)
      )
        exception = true;
      const [collision] = await m.query(
        'SELECT id FROM finance_outgoing_observations WHERE tenant_id=$1 AND provider_code=$2 AND provider_account_reference=$3 AND provider_payment_id=$4 AND intent_id<>$5 LIMIT 1',
        [
          p.tenantId,
          o.provider_code,
          o.provider_account_reference,
          o.provider_payment_id,
          intent.id,
        ],
      );
      if (collision) exception = true;
    }
    for (const o of distinct.values()) paid += units(o.amount) + units(o.fee);
    if (distinct.size > 1) exception = true;
    const cancelled = events.some((e) => e.action === 'CANCEL'),
      reserved = events.some((e) => e.action === 'RESERVE'),
      budget = units(intent.amount) + units(intent.maximum_fee);
    const state = exception
      ? 'EXCEPTION_HELD'
      : confirmed.length
        ? 'CONFIRMED'
        : failed
          ? 'FAILED_FINAL'
          : calls.length
            ? observations.some((o) => o.state === 'PENDING')
              ? 'PENDING'
              : 'UNKNOWN'
            : cancelled
              ? 'CANCELLED'
              : reserved
                ? 'RESERVED'
                : events.some((e) => e.action === 'REJECT')
                  ? 'REJECTED'
                  : events.some((e) => e.action === 'APPROVE')
                    ? 'APPROVED'
                    : 'DRAFT';
    const encumbered = exception
      ? !(reserved || calls.length || paid > 0n)
        ? 0n
        : paid > budget
          ? paid
          : budget
      : confirmed.length
        ? paid
        : failed || cancelled
          ? 0n
          : reserved
            ? budget
            : 0n;
    const obligationUsed =
      cancelled || (failed && !confirmed.length)
        ? 0n
        : reserved
          ? units(intent.amount)
          : 0n;
    return {
      state,
      exception,
      paid,
      encumbered,
      obligationUsed,
      events,
      calls,
      observations,
    };
  }
  private async capacity(
    m: EntityManager,
    p: Actor,
    s: IntegrationScope,
    funding: Row,
    obligation?: Row,
  ) {
    const rows: Row[] = await m.query(
      'SELECT * FROM finance_outgoing_intents WHERE tenant_id=$1 AND (funding_id=$2 OR obligation_id=$3)',
      [p.tenantId, funding.id, obligation?.id ?? null],
    );
    const [sourceConflicts] = await m.query(
      "SELECT count(*)::int n FROM finance_outgoing_aliases WHERE evidence_id=ANY($1::uuid[]) AND state='CONFLICT_HELD'",
      [[funding.id, ...(obligation ? [obligation.id] : [])]],
    );
    let used = 0n,
      obligationUsed = 0n,
      exception = sourceConflicts.n > 0;
    for (const row of rows) {
      const pos = await this.position(m, p, s, row);
      if (row.funding_id === funding.id) {
        used += pos.encumbered;
        exception ||= pos.exception;
      }
      if (row.obligation_id === obligation?.id)
        obligationUsed += pos.obligationUsed;
    }
    return {
      available: units(funding.subject.snapshot.available) - used,
      remaining: obligation
        ? units(obligation.subject.snapshot.amount) - obligationUsed
        : 0n,
      used,
      exception,
    };
  }
  async reserve(
    actor: Actor,
    scope: IntegrationScope,
    ref: Ref,
    key: string,
    reason: string,
  ) {
    const selected = await this.selected(actor, scope, ref);
    return this.command(
      actor,
      scope,
      'RESERVE_CASH',
      selected.currency,
      decimal(units(selected.amount) + units(selected.maximum_fee)),
      reason,
      async (m, p, s, g) => {
        const intent = await this.row(
            m,
            p,
            s,
            'finance_outgoing_intents',
            ref.id,
            ref.hash,
          ),
          events = await this.approval(m, intent);
        if (events.some((e: Row) => e.action === 'RESERVE'))
          return this.event(m, p, s, g, intent, 'RESERVE', key, reason);
        const funding = await this.row(
            m,
            p,
            s,
            'finance_outgoing_evidence',
            intent.funding_id,
          ),
          obligation = await this.row(
            m,
            p,
            s,
            'finance_outgoing_evidence',
            intent.obligation_id,
          ),
          capacity = await this.capacity(m, p, s, funding, obligation);
        await this.ownedProfile(
          m,
          p,
          s,
          { profileId: funding.profile_id, profileHash: funding.profile_hash },
          funding.subject.snapshot,
        );
        if (
          capacity.exception ||
          capacity.available <
            units(intent.amount) + units(intent.maximum_fee) ||
          capacity.remaining < units(intent.amount)
        )
          fail(
            'Insufficient unencumbered cash/obligation capacity or unresolved cash exception.',
          );
        return this.event(m, p, s, g, intent, 'RESERVE', key, reason);
      },
    );
  }
  async cancel(
    actor: Actor,
    scope: IntegrationScope,
    ref: Ref,
    key: string,
    reason: string,
  ) {
    const selected = await this.selected(actor, scope, ref);
    return this.command(
      actor,
      scope,
      'REVIEW_PAYMENT',
      selected.currency,
      decimal(units(selected.amount) + units(selected.maximum_fee)),
      reason,
      async (m, p, s, g) => {
        const intent = await this.row(
            m,
            p,
            s,
            'finance_outgoing_intents',
            ref.id,
            ref.hash,
          ),
          pos = await this.position(m, p, s, intent);
        if (intent.actor_natural_person_id === p.naturalPersonId)
          throw new ForbiddenException('Independent cancellation is required.');
        if (pos.calls.length)
          fail(
            'An attempted or uncertain payment cannot release its reservation by cancellation. Query the original execution key.',
          );
        return this.event(m, p, s, g, intent, 'CANCEL', key, reason);
      },
    );
  }
  private async simulator(m: EntityManager, code: string) {
    const [db] = await m.query(
      'SELECT current_database() name,inet_server_addr()::text address',
    );
    if (
      process.env.NODE_ENV !== 'test' ||
      process.env.APP_ENV !== 'test' ||
      !db.name.startsWith('insurance_portal_test_') ||
      !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(
        db.address.split('/')[0],
      )
    )
      fail(
        'Outgoing execution is restricted to isolated test simulators. Actual payments remain disabled.',
      );
    const candidates = this.simulators.filter(
      (s) =>
        s.purpose === 'ISOLATED_TEST_SIMULATOR_ONLY' && s.providerCode === code,
    );
    if (candidates.length !== 1)
      fail('An explicit unique isolated test simulator is required.');
    return candidates[0];
  }
  async dispatch(
    actor: Actor,
    scope: IntegrationScope,
    ref: Ref,
    operation: 'SUBMIT' | 'QUERY',
    reason: string,
  ) {
    if (!['SUBMIT', 'QUERY'].includes(operation))
      throw new BadRequestException('Unsupported provider operation.');
    const selected = await this.selected(actor, scope, ref),
      prepared = await this.command(
        actor,
        scope,
        'EXECUTE_SIMULATION',
        selected.currency,
        decimal(units(selected.amount) + units(selected.maximum_fee)),
        reason,
        async (m, p, s, g) => {
          const intent = await this.row(
              m,
              p,
              s,
              'finance_outgoing_intents',
              ref.id,
              ref.hash,
            ),
            pos = await this.position(m, p, s, intent),
            simulator = await this.simulator(m, intent.subject.providerCode);
          if (
            ['CONFIRMED', 'FAILED_FINAL', 'EXCEPTION_HELD'].includes(pos.state)
          )
            return { reused: true, intent };
          if (operation === 'SUBMIT') {
            await this.approval(m, intent);
            if (pos.state !== 'RESERVED' || pos.calls.length)
              fail(
                'Submission is single-use. An existing attempt must be queried using its original execution key.',
              );
          } else if (!pos.calls.some((c) => c.operation === 'SUBMIT'))
            fail(
              'Recovery queries require an existing durable submission attempt.',
            );
          const [pending] = await m.query(
            "SELECT c.id FROM finance_outgoing_calls c LEFT JOIN finance_outgoing_observations o ON o.call_id=c.id WHERE c.intent_id=$1 AND c.operation='QUERY' AND o.id IS NULL AND c.lease_until>statement_timestamp()",
            [intent.id],
          );
          if (pending) fail('A recovery query is already in progress.');
          if (operation === 'SUBMIT') {
            const funding = await this.row(
                m,
                p,
                s,
                'finance_outgoing_evidence',
                intent.funding_id,
              ),
              cap = await this.capacity(m, p, s, funding);
            await this.ownedProfile(
              m,
              p,
              s,
              {
                profileId: funding.profile_id,
                profileHash: funding.profile_hash,
              },
              funding.subject.snapshot,
            );
            if (cap.exception || cap.available < 0n)
              fail('Cash capacity has an unresolved exception.');
          }
          const request: CashProviderRequest = {
            executionKey: intent.execution_key,
            providerCode: intent.subject.providerCode,
            providerAccountReference: intent.subject.providerAccountReference,
            beneficiaryHash: intent.beneficiary_hash,
            beneficiary: intent.subject.beneficiary,
            amount: intent.amount,
            maximumFee: intent.maximum_fee,
            currency: intent.currency,
            decimalScale: intent.decimal_scale,
          };
          const [lease] = await m.query(
            "SELECT statement_timestamp()+$1*interval '1 second' until",
            [g.lease_seconds],
          );
          const call = {
            id: randomUUID(),
            ...this.scope(p, s),
            intent_id: intent.id,
            operation,
            lease_until: lease.until,
            ...this.content({
              schema: 'FINANCE_OUTGOING_CALL_V1',
              purpose: 'ISOLATED_TEST_SIMULATOR_ONLY',
              intentHash: intent.subject_hash,
              operation,
              request,
              authorityHash: hash(integrationSnapshot(g)),
            }),
            ...this.actor(p, g),
          };
          await this.insert(
            m,
            'finance_outgoing_calls',
            call,
            p,
            s,
            operation,
            reason,
          );
          return { reused: false, intent, call, request, simulator };
        },
      );
    if (prepared.reused)
      return { ...this.result(prepared.intent, true), providerCalled: false };
    let raw: unknown;
    try {
      raw = await prepared.simulator![
        operation === 'SUBMIT' ? 'submit' : 'query'
      ](cashObject(prepared.request!));
    } catch {
      raw = {
        ...prepared.request,
        state: 'UNKNOWN',
        amount: '0',
        fee: '0',
        providerPaymentId: null,
        evidenceHash: hash({
          callId: prepared.call!.id,
          result: 'TRANSPORT_OUTCOME_UNKNOWN',
        }),
      };
      delete (raw as Row).beneficiary;
      delete (raw as Row).maximumFee;
      delete (raw as Row).decimalScale;
    }
    // Durable call commits before the provider. A failed result commit keeps the call for query recovery.
    await this.recordObservation(prepared.call!.id, raw);
    return { ...this.result(prepared.intent), providerCalled: true };
  }
  private async recordObservation(callId: string, raw: unknown) {
    return this.source.transaction(async (m) => {
      const [call] = await m.query(
        'SELECT * FROM finance_outgoing_calls WHERE id=$1 FOR SHARE',
        [callId],
      );
      if (!call) fail('Durable provider call missing.');
      await m.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        'finance-inactive-config:' + call.tenant_id,
      ]);
      const p: Actor = {
          kind: 'USER',
          tenantId: call.tenant_id,
          subjectId: call.actor_subject_id,
          naturalPersonId: call.actor_natural_person_id,
        },
        s = { legalEntityId: call.legal_entity_id, bookId: call.book_id },
        request: CashProviderRequest = call.subject.request;
      let outcome: CashProviderOutcome | null = null;
      try {
        outcome = normalizeCashOutcome(raw, request.decimalScale);
      } catch {
        /* Preserve mismatching/invalid outcome as evidence, never infer no cash. */
      }
      const matches =
        outcome &&
        outcome.executionKey === request.executionKey &&
        outcome.providerCode === request.providerCode &&
        outcome.providerAccountReference === request.providerAccountReference &&
        outcome.beneficiaryHash === request.beneficiaryHash &&
        outcome.currency === request.currency;
      const subject = {
        schema: 'FINANCE_OUTGOING_OBSERVATION_V1',
        callId,
        callHash: call.subject_hash,
        rawOutcome: cashObject(raw),
        outcome,
        matchesRequest: Boolean(matches),
        accountingState: 'HELD_INACTIVE',
        financialEffects: 0,
      };
      const [old] = await m.query(
        'SELECT * FROM finance_outgoing_observations WHERE call_id=$1',
        [callId],
      );
      if (old) {
        if (old.subject_hash !== hash(subject))
          fail('Provider call outcome is immutable.');
        return;
      }
      const row = {
        id: randomUUID(),
        ...this.scope(p, s),
        intent_id: call.intent_id,
        call_id: callId,
        provider_code: request.providerCode,
        provider_account_reference: request.providerAccountReference,
        provider_payment_id: matches ? outcome!.providerPaymentId : null,
        state: matches ? outcome!.state : 'CONFLICT_HELD',
        amount: matches ? outcome!.amount : '0',
        fee: matches ? outcome!.fee : '0',
        ...this.content(subject),
      };
      await this.insert(
        m,
        'finance_outgoing_observations',
        row,
        p,
        s,
        'OBSERVE_PROVIDER',
        'Persist provider truth after the committed call; no financial posting or legal discharge.',
      );
    });
  }
  async read(actor: Actor, scope: IntegrationScope, ref: Ref) {
    const selected = await this.selected(actor, scope, ref);
    return this.command(
      actor,
      scope,
      'READ_CASH',
      selected.currency,
      '0',
      'Read inactive outgoing-cash position',
      async (m, p, s) => {
        const intent = await this.row(
            m,
            p,
            s,
            'finance_outgoing_intents',
            ref.id,
            ref.hash,
          ),
          pos = await this.position(m, p, s, intent),
          funding = await this.row(
            m,
            p,
            s,
            'finance_outgoing_evidence',
            intent.funding_id,
          ),
          obligation = await this.row(
            m,
            p,
            s,
            'finance_outgoing_evidence',
            intent.obligation_id,
          ),
          capacity = await this.capacity(m, p, s, funding, obligation);
        return {
          ...this.result(intent),
          cashState: pos.state,
          executionKey: intent.execution_key,
          amount: intent.amount,
          maximumFee: intent.maximum_fee,
          confirmedCash: decimal(pos.paid),
          encumbered: decimal(pos.encumbered),
          available: decimal(capacity.available),
          obligationRemaining: decimal(capacity.remaining),
          accountFrozen: capacity.exception,
          providerCalls: pos.calls.map((c) => ({
            id: c.id,
            operation: c.operation,
            hash: c.subject_hash,
          })),
          observations: pos.observations.map((o) => ({
            id: o.id,
            state: o.state,
            hash: o.subject_hash,
          })),
          dischargeReviewRecorded: pos.events.some(
            (e) => e.action === 'DISCHARGE_REVIEW',
          ),
        };
      },
    );
  }
  /** Transaction-local B16 read. No cash command or authority is inferred. */
  async verifiedReference(
    m: EntityManager,
    p: Actor,
    s: IntegrationScope,
    ref: Ref,
  ) {
    const intent = await this.row(
        m,
        p,
        s,
        'finance_outgoing_intents',
        ref.id,
        ref.hash,
      ),
      funding = await this.row(
        m,
        p,
        s,
        'finance_outgoing_evidence',
        intent.funding_id,
      ),
      obligation = await this.row(
        m,
        p,
        s,
        'finance_outgoing_evidence',
        intent.obligation_id,
      );
    for (const evidence of [funding, obligation]) {
      const snap = evidence.subject.snapshot;
      await verifyAcceptedSource(m, p, s, evidence.inbox_id, {
        eventType: OUTGOING_EVENT,
        factKind: 'OUTGOING_EVIDENCE',
        aggregateType: 'OUTGOING_EVIDENCE',
        aggregateId: snap.id,
        companyId: snap.sourceCompanyId,
        revision: snap.sourceRevision,
        snapshotHash: evidence.subject.rawSnapshotHash,
      });
    }
    const position = await this.position(m, p, s, intent);
    let bankReconciled = false;
    for (const event of position.events.filter(
      (e) => e.action === 'RECONCILE',
    )) {
      const bank = await this.row(
          m,
          p,
          s,
          'finance_outgoing_evidence',
          event.subject.details.bankId,
          event.subject.details.bankHash,
        ),
        snap = bank.subject.snapshot;
      const [{ conflict }] = await m.query(
        "SELECT EXISTS(SELECT 1 FROM finance_outgoing_aliases WHERE evidence_id=$1 AND state='CONFLICT_HELD') conflict",
        [bank.id],
      );
      await verifyAcceptedSource(m, p, s, bank.inbox_id, {
        eventType: OUTGOING_EVENT,
        factKind: 'OUTGOING_EVIDENCE',
        aggregateType: 'OUTGOING_EVIDENCE',
        aggregateId: snap.id,
        companyId: snap.sourceCompanyId,
        revision: snap.sourceRevision,
        snapshotHash: bank.subject.rawSnapshotHash,
      });
      if (!conflict) bankReconciled = true;
    }
    return {
      intent,
      funding,
      obligation,
      position,
      bankReconciled,
      accountingState: 'HELD_INACTIVE',
      financialEffects: 0,
    };
  }
  async reconcile(
    actor: Actor,
    scope: IntegrationScope,
    ref: Ref,
    bank: Ref,
    key: string,
    reason: string,
    discharge = false,
  ) {
    const selected = await this.selected(actor, scope, ref);
    return this.command(
      actor,
      scope,
      'RECONCILE_CASH',
      selected.currency,
      decimal(units(selected.amount) + units(selected.maximum_fee)),
      reason,
      async (m, p, s, g) => {
        const intent = await this.row(
            m,
            p,
            s,
            'finance_outgoing_intents',
            ref.id,
            ref.hash,
          ),
          evidence = await this.row(
            m,
            p,
            s,
            'finance_outgoing_evidence',
            bank.id,
            bank.hash,
          ),
          b: BankPaymentEvidence = evidence.subject.snapshot,
          pos = await this.position(m, p, s, intent),
          funding = await this.row(
            m,
            p,
            s,
            'finance_outgoing_evidence',
            intent.funding_id,
          );
        if (
          p.naturalPersonId === intent.actor_natural_person_id ||
          intent.subject.beneficiary.naturalPersonIds.includes(
            p.naturalPersonId,
          )
        )
          throw new ForbiddenException(
            'Independent bank/discharge evidence review is required.',
          );
        const [bankConflicts] = await m.query(
          "SELECT count(*)::int n FROM finance_outgoing_aliases WHERE evidence_id=$1 AND state='CONFLICT_HELD'",
          [evidence.id],
        );
        if (
          b.kind !== 'BANK_PAYMENT' ||
          bankConflicts.n > 0 ||
          pos.state !== 'CONFIRMED' ||
          b.executionKey !== intent.execution_key ||
          b.providerCode !== intent.subject.providerCode ||
          b.providerAccountReference !==
            intent.subject.providerAccountReference ||
          b.beneficiaryHash !== intent.beneficiary_hash ||
          b.sourceCompanyId !== funding.source_company_id ||
          b.sourceAccountId !== funding.source_account_id ||
          b.currency !== intent.currency ||
          b.decimalScale !== intent.decimal_scale ||
          units(b.amount) !== units(intent.amount) ||
          units(b.amount) + units(b.fee) !== pos.paid ||
          !pos.observations.some(
            (o) => o.provider_payment_id === b.providerPaymentId,
          )
        )
          fail(
            'Signed bank evidence does not match the confirmed original cash movement.',
          );
        return this.event(
          m,
          p,
          s,
          g,
          intent,
          discharge ? 'DISCHARGE_REVIEW' : 'RECONCILE',
          key,
          reason,
          {
            bankId: evidence.id,
            bankHash: evidence.subject_hash,
            legalDischargeAccepted: false,
            accountingState: 'HELD_INACTIVE',
            financialEffects: 0,
          },
        );
      },
    );
  }
}
