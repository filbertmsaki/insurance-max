import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import { financeConfigurationHash as hash } from '../../foundation/finance-configuration/finance-configuration.types';
import { candidateText } from '../../accounting/journal-entries/finance-journal-candidate.types';
import {
  channelHash,
  integrationAudit,
  integrationBook,
  integrationProfile,
  integrationSnapshot,
  requireUuid,
} from '../../integrations/finance-events/finance-integration.controls';
import {
  operationsEvidence,
  operationsProfile,
  operationsScope,
  operationsSubject,
  replayReference,
  type OperationsActor,
  type OperationsPermission,
  type OperationsScope,
  type OperationsSubject,
  type ReplayReference,
} from './finance-operations.types';

// Internal only. Principals must be supplied by a future trusted IAM adapter.
type Row = Record<string, any>;
function actor(p: OperationsActor): OperationsActor {
  if (!p || p.kind !== 'USER')
    throw new ForbiddenException(
      'A verified human operations identity is required.',
    );
  for (const id of [p.tenantId, p.subjectId, p.naturalPersonId])
    requireUuid(id);
  return Object.freeze({
    kind: 'USER',
    tenantId: p.tenantId.toLowerCase(),
    subjectId: p.subjectId.toLowerCase(),
    naturalPersonId: p.naturalPersonId.toLowerCase(),
  });
}
function caseHash(r: Row) {
  const { case_hash: _ignored, ...rest } = integrationSnapshot(r);
  return hash(rest);
}
function reference(r: Row): OperationsSubject {
  return { id: r.id, version: r.version, hash: r.case_hash };
}
function worker(p: OperationsActor) {
  return {
    kind: 'WORKER' as const,
    tenantId: p.tenantId,
    subjectId: p.subjectId,
  };
}
function location(s: OperationsScope) {
  return s.kind === 'BOOK' ? [s.legalEntityId, s.bookId] : [null, null];
}

@Injectable()
export class FinanceOperationsService {
  constructor(@InjectDataSource() private readonly source: DataSource) {}

  private async grant(
    m: EntityManager,
    p: OperationsActor,
    s: OperationsScope,
    permission: OperationsPermission,
    lock = true,
  ) {
    const query = `SELECT * FROM finance_operations_authorities WHERE tenant_id=$1 AND scope_kind=$2 AND legal_entity_id IS NOT DISTINCT FROM $3::uuid AND book_id IS NOT DISTINCT FROM $4::uuid AND subject_id=$5 AND natural_person_id=$6 AND permission=$7 AND state='ENABLED' AND revoked_at IS NULL AND valid_from<=statement_timestamp() AND (valid_to IS NULL OR valid_to>statement_timestamp()) ORDER BY id LIMIT 1${lock ? ' FOR SHARE' : ''}`;
    const args = [
      p.tenantId,
      s.kind,
      ...location(s),
      p.subjectId,
      p.naturalPersonId,
      permission,
    ];
    const [g] = await m.query(query, args);
    if (!g)
      throw new ForbiddenException(
        'Current human authority in the exact operations scope is required.',
      );
    const fingerprint = hash(integrationSnapshot(g));
    return {
      id: g.id,
      hash: fingerprint,
      verify: async () => {
        const [current] = await m.query(query, args);
        if (
          !current ||
          current.id !== g.id ||
          hash(integrationSnapshot(current)) !== fingerprint
        )
          throw new ForbiddenException(
            'Operations authority changed or expired before completion.',
          );
      },
    };
  }
  private async command<T>(
    p: OperationsActor,
    s: OperationsScope,
    permission: OperationsPermission,
    reason: string,
    run: (
      m: EntityManager,
      g: Awaited<ReturnType<FinanceOperationsService['grant']>>,
    ) => Promise<T>,
  ) {
    if (!candidateText(reason, 2000))
      throw new BadRequestException(
        'An explicit operations reason is required.',
      );
    return this.source.transaction(async (m) => {
      await m.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        'finance-inactive-config:' + p.tenantId,
      ]);
      if (s.kind === 'BOOK') await integrationBook(m, worker(p), s);
      const g = await this.grant(m, p, s, permission);
      const result = await run(m, g);
      await g.verify();
      return result;
    });
  }
  private async profile(
    m: EntityManager,
    p: OperationsActor,
    controlEntity: string,
    controlBook: string,
    id: string,
    expectedHash?: string,
  ) {
    const [r] = await m.query(
      "SELECT * FROM finance_configuration_releases WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND id=$4 AND kind='EXCEPTION_RULES' AND state='REVIEWED_INACTIVE' AND effective_from<=(statement_timestamp() AT TIME ZONE 'UTC')::date AND (effective_to IS NULL OR effective_to>(statement_timestamp() AT TIME ZONE 'UTC')::date) FOR SHARE",
      [p.tenantId, controlEntity, controlBook, id],
    );
    if (!r || (expectedHash && r.release_hash !== expectedHash))
      throw new ConflictException(
        'An exact current reviewed inactive exception profile is required.',
      );
    await integrationBook(m, worker(p), {
      legalEntityId: controlEntity,
      bookId: controlBook,
    });
    return { row: r, payload: operationsProfile(r.payload, r.dependency_refs) };
  }
  private async target(
    m: EntityManager,
    p: OperationsActor,
    s: OperationsScope,
    id: string,
    lock = true,
  ) {
    const table =
      s.kind === 'SOURCE'
        ? 'finance_integration_intakes'
        : 'finance_reference_outbox';
    const [r] = await m.query(
      `SELECT * FROM ${table} WHERE tenant_id=$1 AND id=$2${s.kind === 'BOOK' ? ' AND legal_entity_id=$3 AND book_id=$4' : ''}${lock ? ' FOR UPDATE' : ''}`,
      [p.tenantId, id, ...(s.kind === 'BOOK' ? location(s) : [])],
    );
    if (!r)
      throw new ForbiddenException(
        'The reference item is unavailable in this scope.',
      );
    const observation: Row = {
      id: r.id,
      lane: s.kind === 'SOURCE' ? 'INTAKE' : 'OUTBOX',
      tenantId: p.tenantId,
      state: r.state,
      version: r.version,
      attemptCount: r.attempt_count,
      reasonCode: r.reason_code,
      createdAt: r.created_at.toISOString(),
      leaseUntil: r.lease_until?.toISOString() ?? null,
    };
    if (s.kind === 'SOURCE')
      Object.assign(observation, {
        rawHash: r.raw_hash,
        signatureHash: r.signature_hash,
        channelHash: r.channel_hash,
        channelId: r.channel_id,
        receiptKey: r.receipt_key,
      });
    else
      Object.assign(observation, {
        payloadHash: r.payload_hash,
        consumerId: r.consumer_id,
        contract: r.contract,
        profileId: r.profile_id,
        profileHash: r.profile_hash,
        legalEntityId: r.legal_entity_id,
        bookId: r.book_id,
      });
    return { row: r, observation, hash: hash(observation), table };
  }
  private async currentTarget(
    m: EntityManager,
    p: OperationsActor,
    s: OperationsScope,
    t: Awaited<ReturnType<FinanceOperationsService['target']>>,
  ) {
    const r = t.row;
    if (s.kind === 'SOURCE') {
      const [channel] = await m.query(
        "SELECT * FROM finance_integration_channels WHERE tenant_id=$1 AND id=$2 AND state='ENABLED' AND revoked_at IS NULL AND valid_from<=statement_timestamp() AND (valid_to IS NULL OR valid_to>statement_timestamp()) FOR SHARE",
        [p.tenantId, r.channel_id],
      );
      if (
        !channel ||
        channelHash(channel) !== r.channel_hash ||
        !r.raw_body ||
        !r.signature_input
      )
        throw new ConflictException(
          'Replay cannot change a captured channel, redacted body or signature.',
        );
      await integrationProfile(m, r.channel_snapshot);
    } else {
      await integrationProfile(m, {
        tenant_id: p.tenantId,
        legal_entity_id: r.control_entity_id,
        book_id: r.control_book_id,
        profile_id: r.profile_id,
        profile_hash: r.profile_hash,
      });
      if (
        r.contract !== 'finance.reference-held.v1' ||
        hash(r.payload) !== r.payload_hash ||
        r.payload.financialEffects !== 0 ||
        r.payload.accountingState !== 'HELD_INACTIVE'
      )
        throw new ConflictException(
          'Only the exact inactive reference outcome can be replayed.',
        );
    }
  }
  private async load(
    m: EntityManager,
    p: OperationsActor,
    s: OperationsScope,
    ref: OperationsSubject,
  ) {
    const [c] = await m.query(
      'SELECT * FROM finance_owned_exceptions WHERE tenant_id=$1 AND scope_kind=$2 AND legal_entity_id IS NOT DISTINCT FROM $3::uuid AND book_id IS NOT DISTINCT FROM $4::uuid AND id=$5 FOR UPDATE',
      [p.tenantId, s.kind, ...location(s), ref.id],
    );
    if (
      !c ||
      c.version !== ref.version ||
      c.case_hash !== ref.hash ||
      caseHash(c) !== c.case_hash
    )
      throw new ConflictException(
        'The exception version, hash or scope is stale.',
      );
    if (c.state === 'CLOSED_OPERATIONAL')
      throw new ConflictException(
        'A verified operational handoff is immutable.',
      );
    return c;
  }
  private async audit(
    m: EntityManager,
    p: OperationsActor,
    c: Row,
    action: string,
    reason: string,
    evidence: unknown = {},
    r?: Row,
    execution?: string,
  ) {
    await m.query(
      'INSERT INTO finance_operations_audits(tenant_id,case_id,request_id,execution_id,action,case_version,subject_hash,actor_subject_id,actor_natural_person_id,reason,evidence) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
      [
        p.tenantId,
        c.id,
        r?.id ?? null,
        execution ?? null,
        action,
        c.version,
        r?.request_hash ?? c.case_hash,
        p.subjectId,
        p.naturalPersonId,
        reason,
        evidence,
      ],
    );
  }
  private async change(
    m: EntityManager,
    p: OperationsActor,
    c: Row,
    changes: Row,
    action: string,
    reason: string,
    evidence: unknown = {},
  ) {
    const next: Row = { ...c, ...changes, version: c.version + 1 };
    next.case_hash = caseHash(next);
    const keys = Object.keys(changes),
      params = [
        p.tenantId,
        c.id,
        next.version,
        next.case_hash,
        ...keys.map((k) => changes[k]),
      ];
    await m.query(
      `UPDATE finance_owned_exceptions SET version=$3,case_hash=$4${keys.map((k, i) => `,${k}=$${i + 5}`).join('')} WHERE tenant_id=$1 AND id=$2`,
      params,
    );
    await this.audit(m, p, next, action, reason, evidence);
    return next;
  }

  async register(
    p: OperationsActor,
    s: OperationsScope,
    itemId: string,
    profile: { legalEntityId: string; bookId: string; id: string },
    reason: string,
  ) {
    p = actor(p);
    s = operationsScope(s);
    requireUuid(itemId);
    for (const id of [profile?.id, profile?.legalEntityId, profile?.bookId])
      requireUuid(id);
    profile = { ...profile };
    return this.command(p, s, 'ASSIGN_EXCEPTION', reason, async (m) => {
      const t = await this.target(m, p, s, itemId);
      const control =
        s.kind === 'SOURCE'
          ? t.row.channel_snapshot
          : {
              legal_entity_id: t.row.control_entity_id,
              book_id: t.row.control_book_id,
            };
      if (
        control.legal_entity_id !== profile.legalEntityId ||
        control.book_id !== profile.bookId
      )
        throw new ConflictException(
          'The exception policy must belong to the original integration control scope.',
        );
      if (!['HELD', 'DEAD_LETTER', 'HELD_UNSUPPORTED'].includes(t.row.state))
        throw new ConflictException(
          'Only terminal inactive reference failures can be registered for replay.',
        );
      const pol = await this.profile(
        m,
        p,
        profile.legalEntityId,
        profile.bookId,
        profile.id,
      );
      const [exists] = await m.query(
        `SELECT id FROM finance_owned_exceptions WHERE ${s.kind === 'SOURCE' ? 'intake_id' : 'outbox_id'}=$1`,
        [itemId],
      );
      if (exists)
        throw new ConflictException(
          'An owned exception already exists for this item.',
        );
      const [clock] = await m.query('SELECT statement_timestamp() AS now');
      const c: Row = {
        id: randomUUID(),
        tenant_id: p.tenantId,
        scope_kind: s.kind,
        legal_entity_id: s.kind === 'BOOK' ? s.legalEntityId : null,
        book_id: s.kind === 'BOOK' ? s.bookId : null,
        intake_id: s.kind === 'SOURCE' ? itemId : null,
        outbox_id: s.kind === 'BOOK' ? itemId : null,
        observation: t.observation,
        observation_hash: t.hash,
        control_entity_id: profile.legalEntityId,
        control_book_id: profile.bookId,
        profile_id: profile.id,
        profile_hash: pol.row.release_hash,
        owner_subject_id: null,
        owner_natural_person_id: null,
        assigned_at: null,
        proposed_due_at: null,
        origin_owner_reference: t.row.owner_reference,
        state: 'OPEN',
        version: 1,
        created_at: clock.now,
      };
      c.case_hash = caseHash(c);
      const keys = Object.keys(c);
      await m.query(
        `INSERT INTO finance_owned_exceptions(${keys.join(',')}) VALUES(${keys.map((_, i) => '$' + (i + 1)).join(',')})`,
        keys.map((k) => c[k]),
      );
      await this.audit(m, p, c, 'REGISTERED', reason);
      return reference(c);
    });
  }
  async assign(
    p: OperationsActor,
    s: OperationsScope,
    ref: OperationsSubject,
    owner: OperationsActor,
    reason: string,
  ) {
    p = actor(p);
    owner = actor(owner);
    s = operationsScope(s);
    ref = operationsSubject(ref);
    if (owner.tenantId !== p.tenantId)
      throw new ForbiddenException('An owner must belong to the exact tenant.');
    return this.command(p, s, 'ASSIGN_EXCEPTION', reason, async (m) => {
      const c = await this.load(m, p, s, ref),
        g = await this.grant(m, owner, s, 'OWN_EXCEPTION');
      const pol = await this.profile(
        m,
        p,
        c.control_entity_id,
        c.control_book_id,
        c.profile_id,
        c.profile_hash,
      );
      const [clock] = await m.query(
        "SELECT statement_timestamp() AS now,CASE WHEN $1::integer IS NULL THEN NULL ELSE statement_timestamp()+$1*interval '1 second' END AS due",
        [pol.payload.proposedOwnerDueSeconds],
      );
      const n = await this.change(
        m,
        p,
        c,
        {
          owner_subject_id: owner.subjectId,
          owner_natural_person_id: owner.naturalPersonId,
          assigned_at: clock.now,
          proposed_due_at: clock.due,
          state: 'OPEN',
        },
        'OWNER_ASSIGNED',
        reason,
        { ownerGrantId: g.id, ownerGrantHash: g.hash },
      );
      await g.verify();
      return reference(n);
    });
  }
  async refresh(
    p: OperationsActor,
    s: OperationsScope,
    ref: OperationsSubject,
    reason: string,
  ) {
    p = actor(p);
    s = operationsScope(s);
    ref = operationsSubject(ref);
    return this.command(p, s, 'ASSIGN_EXCEPTION', reason, async (m) => {
      const c = await this.load(m, p, s, ref),
        t = await this.target(m, p, s, c.intake_id ?? c.outbox_id);
      if (t.hash === c.observation_hash) return reference(c);
      return reference(
        await this.change(
          m,
          p,
          c,
          {
            observation: t.observation,
            observation_hash: t.hash,
            state: 'OPEN',
          },
          'OBSERVATION_REFRESHED',
          reason,
        ),
      );
    });
  }
  private async owner(
    m: EntityManager,
    p: OperationsActor,
    s: OperationsScope,
    c: Row,
  ) {
    if (
      c.owner_subject_id !== p.subjectId ||
      c.owner_natural_person_id !== p.naturalPersonId
    )
      throw new ForbiddenException(
        'Only the assigned current human owner can prepare replay.',
      );
    return this.grant(m, p, s, 'OWN_EXCEPTION');
  }
  async prepareReplay(
    p: OperationsActor,
    s: OperationsScope,
    ref: OperationsSubject,
    evidence: unknown,
    reason: string,
  ): Promise<ReplayReference> {
    p = actor(p);
    s = operationsScope(s);
    ref = operationsSubject(ref);
    evidence = operationsEvidence(evidence);
    return this.command(p, s, 'PREPARE_REPLAY', reason, async (m, g) => {
      const c = await this.load(m, p, s, ref),
        og = await this.owner(m, p, s, c),
        t = await this.target(m, p, s, c.intake_id ?? c.outbox_id);
      if (
        t.hash !== c.observation_hash ||
        !['HELD', 'DEAD_LETTER', 'HELD_UNSUPPORTED'].includes(t.row.state)
      )
        throw new ConflictException(
          'Replay requires the exact observed terminal reference item.',
        );
      await this.currentTarget(m, p, s, t);
      const pol = await this.profile(
        m,
        p,
        c.control_entity_id,
        c.control_book_id,
        c.profile_id,
        c.profile_hash,
      );
      const [count] = await m.query(
        'SELECT count(*)::integer AS count FROM finance_replay_executions WHERE tenant_id=$1 AND case_id=$2',
        [p.tenantId, c.id],
      );
      if (count.count >= pol.payload.maxReplaysPerItem)
        throw new ConflictException(
          'The explicit per-item replay limit is exhausted.',
        );
      const [clock] = await m.query(
        "SELECT statement_timestamp()+$1*interval '1 second' AS expiry",
        [pol.payload.replayTtlSeconds],
      );
      const subject = {
        scope: s,
        caseId: c.id,
        caseVersion: c.version,
        caseHash: c.case_hash,
        observation: t.observation,
        observationHash: t.hash,
        profileId: pol.row.id,
        profileHash: pol.row.release_hash,
        policy: pol.payload,
        maker: {
          tenantId: p.tenantId,
          subjectId: p.subjectId,
          naturalPersonId: p.naturalPersonId,
        },
        ownerGrant: { id: og.id, hash: og.hash },
        makerGrant: { id: g.id, hash: g.hash },
        expiresAt: clock.expiry.toISOString(),
        evidence,
      };
      const r = { id: randomUUID(), request_hash: hash(subject) };
      await m.query(
        'INSERT INTO finance_replay_requests(id,tenant_id,case_id,case_version,subject,request_hash,maker_subject_id,maker_natural_person_id,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        [
          r.id,
          p.tenantId,
          c.id,
          c.version,
          subject,
          r.request_hash,
          p.subjectId,
          p.naturalPersonId,
          clock.expiry,
        ],
      );
      await this.audit(m, p, c, 'REPLAY_PREPARED', reason, evidence, r);
      await og.verify();
      return { id: r.id, hash: r.request_hash };
    });
  }
  private async request(
    m: EntityManager,
    p: OperationsActor,
    s: OperationsScope,
    ref: ReplayReference,
  ) {
    const [r] = await m.query(
      'SELECT * FROM finance_replay_requests WHERE tenant_id=$1 AND id=$2 FOR UPDATE',
      [p.tenantId, ref.id],
    );
    if (
      !r ||
      r.request_hash !== ref.hash ||
      hash(r.subject) !== ref.hash ||
      hash(r.subject.scope) !== hash(s)
    )
      throw new ConflictException(
        'The exact scoped replay request is unavailable.',
      );
    return r;
  }
  private async validateRequest(
    m: EntityManager,
    p: OperationsActor,
    s: OperationsScope,
    r: Row,
  ) {
    const c = await this.load(m, p, s, {
      id: r.case_id,
      version: r.case_version,
      hash: r.subject.caseHash,
    });
    const [clock] = await m.query(
      'SELECT $1::timestamptz>statement_timestamp() AS valid',
      [r.expires_at],
    );
    if (!clock.valid)
      throw new ConflictException('The replay request expired.');
    const maker = actor({ kind: 'USER', ...r.subject.maker }),
      og = await this.owner(m, maker, s, c),
      mg = await this.grant(m, maker, s, 'PREPARE_REPLAY');
    if (
      og.id !== r.subject.ownerGrant.id ||
      og.hash !== r.subject.ownerGrant.hash ||
      mg.id !== r.subject.makerGrant.id ||
      mg.hash !== r.subject.makerGrant.hash
    )
      throw new ConflictException(
        'The frozen owner or maker authority changed.',
      );
    const t = await this.target(m, p, s, c.intake_id ?? c.outbox_id);
    if (t.hash !== r.subject.observationHash || t.hash !== c.observation_hash)
      throw new ConflictException('The replay target changed.');
    await this.currentTarget(m, p, s, t);
    const pol = await this.profile(
      m,
      p,
      c.control_entity_id,
      c.control_book_id,
      c.profile_id,
      c.profile_hash,
    );
    if (
      pol.row.release_hash !== r.subject.profileHash ||
      hash(pol.payload) !== hash(r.subject.policy)
    )
      throw new ConflictException('The frozen replay policy changed.');
    return {
      c,
      t,
      verify: async () => {
        await og.verify();
        await mg.verify();
        await this.profile(
          m,
          p,
          c.control_entity_id,
          c.control_book_id,
          c.profile_id,
          c.profile_hash,
        );
        await this.currentTarget(m, p, s, t);
        const [x] = await m.query(
          'SELECT $1::timestamptz>statement_timestamp() AS valid',
          [r.expires_at],
        );
        if (!x.valid)
          throw new ConflictException('Replay expired before completion.');
      },
    };
  }
  async reviewReplay(
    p: OperationsActor,
    s: OperationsScope,
    ref: ReplayReference,
    decision: 'APPROVED' | 'REJECTED',
    reason: string,
  ) {
    p = actor(p);
    s = operationsScope(s);
    ref = replayReference(ref);
    if (!['APPROVED', 'REJECTED'].includes(decision))
      throw new BadRequestException('An explicit replay decision is required.');
    return this.command(p, s, 'REVIEW_REPLAY', reason, async (m, g) => {
      const r = await this.request(m, p, s, ref);
      if (
        r.state !== 'PREPARED' ||
        r.maker_subject_id === p.subjectId ||
        r.maker_natural_person_id === p.naturalPersonId
      )
        throw new ForbiddenException(
          'Replay requires an independent human reviewer.',
        );
      const { c, verify } = await this.validateRequest(m, p, s, r);
      await m.query(
        'UPDATE finance_replay_requests SET state=$2,reviewer_subject_id=$3,reviewer_natural_person_id=$4,reviewer_grant_id=$5,reviewer_grant_hash=$6 WHERE id=$1',
        [r.id, decision, p.subjectId, p.naturalPersonId, g.id, g.hash],
      );
      await this.audit(m, p, c, 'REPLAY_' + decision, reason, {}, r);
      await verify();
      return { state: decision, accountingState: 'HELD_INACTIVE' };
    });
  }
  async executeReplay(
    p: OperationsActor,
    s: OperationsScope,
    ref: ReplayReference,
    reason: string,
  ) {
    p = actor(p);
    s = operationsScope(s);
    ref = replayReference(ref);
    return this.command(p, s, 'EXECUTE_REPLAY', reason, async (m) => {
      const r = await this.request(m, p, s, ref);
      if (
        r.reviewer_subject_id !== p.subjectId ||
        r.reviewer_natural_person_id !== p.naturalPersonId
      )
        throw new ForbiddenException(
          'Only the recorded independent reviewer can execute the approved replay.',
        );
      const rg = await this.grant(m, p, s, 'REVIEW_REPLAY');
      if (rg.id !== r.reviewer_grant_id || rg.hash !== r.reviewer_grant_hash)
        throw new ConflictException('Reviewer authority changed.');
      if (r.state === 'EXECUTED') {
        const [old] = await m.query(
          'SELECT id FROM finance_replay_executions WHERE tenant_id=$1 AND request_id=$2',
          [p.tenantId, r.id],
        );
        if (!old)
          throw new ConflictException(
            'The recorded replay execution evidence is missing.',
          );
        await rg.verify();
        return {
          executionId: old.id,
          reused: true,
          accountingState: 'HELD_INACTIVE',
        };
      }
      if (r.state !== 'APPROVED')
        throw new ConflictException(
          'Only an independently approved replay can execute.',
        );
      const { c, t, verify } = await this.validateRequest(m, p, s, r),
        executionId = randomUUID();
      await m.query(
        'INSERT INTO finance_replay_executions(id,request_id,tenant_id,case_id,lane,item_id,before_version,after_version,prior_attempt_count,attempt_ceiling,executor_subject_id,executor_natural_person_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
        [
          executionId,
          r.id,
          p.tenantId,
          c.id,
          t.observation.lane,
          t.row.id,
          t.row.version,
          t.row.version + 1,
          t.row.attempt_count,
          t.row.attempt_count + r.subject.policy.additionalAttempts,
          p.subjectId,
          p.naturalPersonId,
        ],
      );
      await m.query(
        `UPDATE ${t.table} SET state='RETRY_WAIT',version=version+1,lease_token=NULL,lease_subject_id=NULL,lease_until=NULL,next_attempt_at=statement_timestamp(),reason_code='CONTROLLED_REFERENCE_REPLAY' WHERE tenant_id=$1 AND id=$2`,
        [p.tenantId, t.row.id],
      );
      await integrationAudit(m, {
        tenantId: p.tenantId,
        ...(s.kind === 'BOOK'
          ? { legalEntityId: s.legalEntityId, bookId: s.bookId }
          : {}),
        kind: s.kind === 'SOURCE' ? 'intake' : 'outbox',
        id: t.row.id,
        action: 'CONTROLLED_REFERENCE_REPLAY',
        version: t.row.version + 1,
        actor: p.subjectId,
        hash: s.kind === 'SOURCE' ? t.row.raw_hash : t.row.payload_hash,
        reason: 'CONTROLLED_REFERENCE_REPLAY',
      });
      const next = await this.change(
        m,
        p,
        c,
        { state: 'MONITORING_REPLAY' },
        'REPLAY_QUEUED',
        reason,
        { executionId },
      );
      await m.query(
        "UPDATE finance_replay_requests SET state='EXECUTED' WHERE id=$1",
        [r.id],
      );
      await this.audit(
        m,
        p,
        next,
        'REPLAY_EXECUTED',
        reason,
        {},
        r,
        executionId,
      );
      await verify();
      await rg.verify();
      return { executionId, reused: false, accountingState: 'HELD_INACTIVE' };
    });
  }
  async escalate(
    p: OperationsActor,
    s: OperationsScope,
    ref: OperationsSubject,
    reason: string,
  ) {
    p = actor(p);
    s = operationsScope(s);
    ref = operationsSubject(ref);
    return this.command(p, s, 'ESCALATE_EXCEPTION', reason, async (m) => {
      const c = await this.load(m, p, s, ref),
        pol = await this.profile(
          m,
          p,
          c.control_entity_id,
          c.control_book_id,
          c.profile_id,
          c.profile_hash,
        );
      let ownerCurrent = false;
      if (c.owner_subject_id)
        try {
          await this.grant(
            m,
            actor({
              kind: 'USER',
              tenantId: p.tenantId,
              subjectId: c.owner_subject_id,
              naturalPersonId: c.owner_natural_person_id,
            }),
            s,
            'OWN_EXCEPTION',
          );
          ownerCurrent = true;
        } catch (e) {
          if (!(e instanceof ForbiddenException)) throw e;
        }
      const [clock] = await m.query(
        "SELECT ($1::timestamptz IS NOT NULL AND $1<=statement_timestamp()) OR ($2::integer IS NOT NULL AND $3::timestamptz+$2*interval '1 second'<=statement_timestamp()) AS proposed_due",
        [
          c.proposed_due_at,
          pol.payload.proposedEscalationSeconds,
          c.created_at,
        ],
      );
      if (ownerCurrent && !clock.proposed_due)
        throw new ConflictException(
          'There is no stale ownership or elapsed proposed escalation window.',
        );
      return reference(
        await this.change(
          m,
          p,
          c,
          { state: 'ESCALATED' },
          'ESCALATED',
          reason,
          {
            ownerCurrent,
            proposedWindowElapsed: clock.proposed_due,
            operatingSlaApproved: false,
          },
        ),
      );
    });
  }
  async verifyHandoff(
    p: OperationsActor,
    s: OperationsScope,
    ref: OperationsSubject,
    evidence: unknown,
    reason: string,
  ) {
    p = actor(p);
    s = operationsScope(s);
    ref = operationsSubject(ref);
    evidence = operationsEvidence(evidence);
    return this.command(p, s, 'VERIFY_HANDOFF', reason, async (m) => {
      const c = await this.load(m, p, s, ref),
        t = await this.target(m, p, s, c.intake_id ?? c.outbox_id);
      if (
        !c.owner_subject_id ||
        p.subjectId === c.owner_subject_id ||
        p.naturalPersonId === c.owner_natural_person_id
      )
        throw new ForbiddenException(
          'Operational handoff requires a verifier independent of the assigned owner.',
        );
      if (
        (s.kind === 'SOURCE' && t.row.state !== 'DISPOSITION_RECORDED') ||
        (s.kind === 'BOOK' && t.row.state !== 'ACKNOWLEDGED')
      )
        throw new ConflictException(
          'No positive durable reference handoff exists.',
        );
      const [a] = await m.query(
        `SELECT id FROM finance_integration_audits WHERE tenant_id=$1 AND ${s.kind === 'SOURCE' ? 'intake_id' : 'outbox_id'}=$2 AND version=$3 AND action=$4`,
        [p.tenantId, t.row.id, t.row.version, t.row.state],
      );
      if (!a)
        throw new ConflictException('The positive handoff audit is missing.');
      if (s.kind === 'SOURCE') {
        const [missing] = await m.query(
          'SELECT count(*)::integer AS count FROM finance_source_event_preview_targets t WHERE t.tenant_id=$1 AND t.preview_id=$2 AND NOT EXISTS(SELECT 1 FROM finance_integration_inboxes i JOIN finance_reference_dispositions d ON d.inbox_id=i.id JOIN finance_reference_outbox o ON o.inbox_id=i.id WHERE i.tenant_id=t.tenant_id AND i.legal_entity_id=t.legal_entity_id AND i.book_id=t.book_id AND i.preview_id=t.preview_id)',
          [p.tenantId, t.row.preview_id],
        );
        if (missing.count)
          throw new ConflictException(
            'Canonical reference destinations are incomplete.',
          );
      }
      const next = await this.change(
        m,
        p,
        c,
        {
          state: 'CLOSED_OPERATIONAL',
          observation: t.observation,
          observation_hash: t.hash,
        },
        'HANDOFF_VERIFIED',
        reason,
        {
          evidence,
          positiveAuditId: a.id,
          financialRecoveryCertified: false,
          accountingState: 'HELD_INACTIVE',
        },
      );
      return {
        ...reference(next),
        state: 'CLOSED_OPERATIONAL',
        financialRecoveryCertified: false,
        accountingState: 'HELD_INACTIVE',
      };
    });
  }
  async telemetry(p: OperationsActor, s: OperationsScope) {
    return this.read(p, s, 'READ_TELEMETRY');
  }
  async list(p: OperationsActor, s: OperationsScope) {
    return this.read(p, s, 'VIEW_EXCEPTIONS');
  }
  private async read(
    p: OperationsActor,
    s: OperationsScope,
    permission: OperationsPermission,
  ) {
    p = actor(p);
    s = operationsScope(s);
    return this.source.transaction('REPEATABLE READ', async (m) => {
      await m.query('SET TRANSACTION READ ONLY');
      const g = await this.grant(m, p, s, permission, false);
      if (s.kind === 'BOOK') await integrationBook(m, worker(p), s, false);
      const rows = await m.query(
        `SELECT c.id,c.version,c.case_hash,c.state,c.origin_owner_reference,c.proposed_due_at,c.owner_subject_id,
        CASE WHEN c.owner_subject_id IS NULL THEN 'UNASSIGNED' WHEN EXISTS(SELECT 1 FROM finance_operations_authorities a WHERE a.tenant_id=c.tenant_id AND a.scope_kind=c.scope_kind AND a.legal_entity_id IS NOT DISTINCT FROM c.legal_entity_id AND a.book_id IS NOT DISTINCT FROM c.book_id AND a.subject_id=c.owner_subject_id AND a.natural_person_id=c.owner_natural_person_id AND a.permission='OWN_EXCEPTION' AND a.state='ENABLED' AND a.revoked_at IS NULL AND a.valid_from<=statement_timestamp() AND (a.valid_to IS NULL OR a.valid_to>statement_timestamp())) THEN 'CURRENT' ELSE 'STALE' END AS ownership,
        CASE WHEN c.proposed_due_at IS NULL THEN NULL ELSE c.proposed_due_at<=statement_timestamp() END AS proposed_overdue
        FROM finance_owned_exceptions c WHERE c.tenant_id=$1 AND c.scope_kind=$2 AND c.legal_entity_id IS NOT DISTINCT FROM $3::uuid AND c.book_id IS NOT DISTINCT FROM $4::uuid ORDER BY c.id`,
        [p.tenantId, s.kind, ...location(s)],
      );
      const table =
          s.kind === 'SOURCE'
            ? 'finance_integration_intakes'
            : 'finance_reference_outbox',
        key = s.kind === 'SOURCE' ? 'intake_id' : 'outbox_id';
      const items = await m.query(
        `SELECT i.id,i.state,i.version,i.attempt_count,i.reason_code,i.created_at,GREATEST(0,extract(epoch FROM statement_timestamp()-i.created_at))::double precision AS age_seconds,(i.state='LEASED' AND i.lease_until<=statement_timestamp()) AS expired_lease,EXISTS(SELECT 1 FROM finance_owned_exceptions c WHERE c.tenant_id=i.tenant_id AND c.${key}=i.id) AS registered FROM ${table} i WHERE i.tenant_id=$1${s.kind === 'BOOK' ? ' AND i.legal_entity_id=$2 AND i.book_id=$3' : ''} ORDER BY i.id`,
        [p.tenantId, ...(s.kind === 'BOOK' ? location(s) : [])],
      );
      await g.verify();
      return {
        scope: s,
        cases: rows,
        items,
        states: items.reduce((totals: Record<string, number>, r: Row) => {
          totals[r.state] = (totals[r.state] ?? 0) + 1;
          return totals;
        }, {}),
        oldestOutstandingAgeSeconds: items
          .filter(
            (r: Row) =>
              !['ACKNOWLEDGED', 'DISPOSITION_RECORDED'].includes(r.state),
          )
          .reduce(
            (oldest: number | null, r: Row) =>
              Math.max(oldest ?? 0, r.age_seconds),
            null,
          ),
        counts: {
          cases: rows.length,
          totalAttempts: items.reduce(
            (total: number, r: Row) => total + r.attempt_count,
            0,
          ),
          proposedOverdue: rows.filter((r: Row) => r.proposed_overdue === true)
            .length,
          unassigned: rows.filter((r: Row) => r.ownership === 'UNASSIGNED')
            .length,
          staleOwners: rows.filter((r: Row) => r.ownership === 'STALE').length,
          expiredLeases: items.filter((r: Row) => r.expired_lease).length,
          unregisteredFailures: items.filter(
            (r: Row) =>
              ['HELD', 'DEAD_LETTER', 'HELD_UNSUPPORTED'].includes(r.state) &&
              !r.registered,
          ).length,
        },
        slaStatus: 'PENDING_APPROVAL',
        accountingState: 'HELD_INACTIVE',
        financialRecoveryCertified: false,
        financialEffects: 0,
      };
    });
  }
}
