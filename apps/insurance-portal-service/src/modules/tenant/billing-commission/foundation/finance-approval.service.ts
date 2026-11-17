import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import {
  canonicalFinanceJson,
  financeConfigurationHash,
  FINANCE_UUID,
  type FinanceConfigurationActor,
} from './finance-configuration.types';
import {
  candidateAmount,
  candidateText,
} from './finance-journal-candidate.types';
import {
  APPROVAL_HASH,
  normalizeBeneficiary,
  validateApprovalProfile,
  validateApprovalToken,
  type ApprovalToken,
  type BeneficiaryEvidence,
  type InactiveApprovalProfile,
} from './finance-approval.types';
import type { FinanceBookSelection } from './finance-scope.service';
import type { InactiveJournalCandidate } from './finance-journal-candidate.service';

interface ApprovalRequest {
  id: string;
  candidate_id: string;
  candidate_hash: string;
  profile_id: string;
  profile_hash: string;
  beneficiary: BeneficiaryEvidence;
  beneficiary_hash: string;
  amount: string;
  currency: string;
  subject: { profile: InactiveApprovalProfile; [key: string]: unknown };
  request_hash: string;
  maker_subject_id: string;
  maker_natural_person_id: string;
  expires_at: Date;
  state: 'OPEN_INACTIVE' | 'REJECTED_INACTIVE' | 'CONSUMED_INACTIVE';
}
interface Mandate {
  id: string;
  tenant_id: string;
  legal_entity_id: string;
  book_id: string;
  subject_id: string;
  natural_person_id: string;
  role_code: string;
  currency: string;
  max_amount: string;
  delegated_from_id: string | null;
  version: number;
  authority_reference: string;
  valid_from: Date;
  valid_to: Date | null;
  state: string;
  revoked_at: Date | null;
}
interface Decision {
  id: string;
  request_id: string;
  mandate_id: string;
  mandate_hash: string;
  represented_natural_person_id: string;
  actor_subject_id: string;
  actor_natural_person_id: string;
  action: string;
  decision_hash: string;
}
interface Context {
  manager: EntityManager;
  actor: FinanceConfigurationActor;
  scope: FinanceBookSelection;
  checks: (() => Promise<void>)[];
  reason: string;
}

/** Approval content and validation authority remain strictly inactive. */
@Injectable()
export class FinanceApprovalService {
  constructor(@InjectDataSource() private readonly source: DataSource) {}

  async requestInactive(
    actor: FinanceConfigurationActor,
    scope: FinanceBookSelection,
    candidateId: string,
    candidateHash: string,
    profileId: string,
    profileHash: string,
    beneficiary: BeneficiaryEvidence,
    reason: string,
  ): Promise<ApprovalToken> {
    this.reference(candidateId, candidateHash);
    this.reference(profileId, profileHash);
    const evidence = normalizeBeneficiary(beneficiary);
    return this.command(
      actor,
      scope,
      'PREPARE_CANDIDATE',
      reason,
      async (c) => {
        const row = await this.candidate(c, candidateId.toLowerCase());
        if (
          row.subject_hash !== candidateHash ||
          row.state !== 'PREPARED_INACTIVE' ||
          row.maker_subject_id !== c.actor.subjectId ||
          row.maker_natural_person_id !== c.actor.naturalPersonId
        )
          throw new ForbiddenException(
            'Only the exact candidate preparer can freeze its inactive approval subject.',
          );
        const profile = await this.profile(
          c,
          row,
          profileId.toLowerCase(),
          profileHash,
        );
        const [{ amount }] = await c.manager.query(
          'SELECT sum(debit)::text AS amount FROM finance_journal_candidate_lines WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND candidate_id=$4',
          [...this.scope(c), row.id],
        );
        candidateAmount(amount, 12);
        if (candidateAmount(amount, 12).units <= 0n)
          throw new ConflictException(
            'An exact positive complete candidate amount is required.',
          );
        const [{ expires_at }] = await c.manager.query(
          "SELECT statement_timestamp()+$1*interval '1 second' AS expires_at",
          [profile.ttlSeconds],
        );
        const beneficiaryHash = financeConfigurationHash(evidence);
        const subject = {
          tenantId: c.actor.tenantId,
          ...c.scope,
          candidateId: row.id,
          candidateHash: row.subject_hash,
          profileId: profileId.toLowerCase(),
          profileHash,
          profile,
          beneficiaryHash,
          amount,
          currency: row.currency,
          makerSubjectId: row.maker_subject_id,
          makerNaturalPersonId: row.maker_natural_person_id,
          expiresAt: (expires_at as Date).toISOString(),
        };
        const hash = financeConfigurationHash(subject);
        const [request]: ApprovalRequest[] = await c.manager.query(
          `INSERT INTO finance_approval_requests (tenant_id,legal_entity_id,book_id,candidate_id,candidate_hash,profile_id,profile_hash,beneficiary,beneficiary_hash,amount,currency,subject,request_hash,maker_subject_id,maker_natural_person_id,expires_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12::jsonb,$13,$14,$15,$16) RETURNING *`,
          [
            ...this.scope(c),
            row.id,
            row.subject_hash,
            profileId.toLowerCase(),
            profileHash,
            canonicalFinanceJson(evidence),
            beneficiaryHash,
            amount,
            row.currency,
            canonicalFinanceJson(subject),
            hash,
            c.actor.subjectId,
            c.actor.naturalPersonId,
            expires_at,
          ],
        );
        await this.event(c, request, null, 'REQUESTED_INACTIVE');
        c.checks.push(() => this.fresh(c, request));
        return { requestId: request.id, requestHash: hash, beneficiaryHash };
      },
    );
  }

  async decideInactive(
    actor: FinanceConfigurationActor,
    scope: FinanceBookSelection,
    tokenValue: ApprovalToken,
    mandateId: string,
    decision: 'APPROVED_INACTIVE' | 'REJECTED_INACTIVE',
    reason: string,
  ) {
    const token = validateApprovalToken(tokenValue);
    this.uuid(mandateId);
    if (!['APPROVED_INACTIVE', 'REJECTED_INACTIVE'].includes(decision))
      throw new BadRequestException(
        'Only inactive approval or rejection is supported.',
      );
    return this.command(
      actor,
      scope,
      { mandateId: mandateId.toLowerCase() },
      reason,
      async (c) => {
        const request = await this.request(c, token),
          row = await this.candidate(c, request.candidate_id);
        await this.current(c, request, row);
        const mandate = await this.mandate(
          c,
          request,
          mandateId.toLowerCase(),
          c.actor,
        );
        const previous: Decision[] = await c.manager.query(
          'SELECT * FROM finance_approval_decisions WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND request_id=$4',
          [...this.scope(c), request.id],
        );
        const persons = new Set([c.actor.naturalPersonId, mandate.represented]);
        if (
          previous.some(
            (d) =>
              persons.has(d.actor_natural_person_id) ||
              persons.has(d.represented_natural_person_id),
          )
        )
          throw new ForbiddenException(
            'Aliases and delegations cannot supply additional votes for the same people.',
          );
        if (previous.length >= request.subject.profile.requiredCheckers)
          throw new ConflictException(
            'The inactive quorum already has its bounded decisions.',
          );
        const subject = {
          requestHash: request.request_hash,
          mandateId: mandateId.toLowerCase(),
          mandateHash: mandate.hash,
          actorSubjectId: c.actor.subjectId,
          actorNaturalPersonId: c.actor.naturalPersonId,
          representedNaturalPersonId: mandate.represented,
          action: decision,
        };
        const [saved]: Decision[] = await c.manager.query(
          `INSERT INTO finance_approval_decisions (tenant_id,legal_entity_id,book_id,request_id,mandate_id,mandate_hash,represented_natural_person_id,actor_subject_id,actor_natural_person_id,action,decision_hash) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
          [
            ...this.scope(c),
            request.id,
            mandateId.toLowerCase(),
            mandate.hash,
            mandate.represented,
            c.actor.subjectId,
            c.actor.naturalPersonId,
            decision,
            financeConfigurationHash(subject),
          ],
        );
        if (decision === 'REJECTED_INACTIVE')
          await c.manager.query(
            "UPDATE finance_approval_requests SET state='REJECTED_INACTIVE' WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND id=$4",
            [...this.scope(c), request.id],
          );
        await this.event(c, request, saved.id, decision);
        c.checks.push(mandate.verify);
        c.checks.push(() => this.fresh(c, request));
        return {
          id: saved.id,
          requestHash: request.request_hash,
          action: decision,
        };
      },
    );
  }

  /** Used only by the candidate writer inside its already locked transaction. */
  async consumeInactive(
    manager: EntityManager,
    actor: FinanceConfigurationActor,
    scope: FinanceBookSelection,
    row: InactiveJournalCandidate,
    tokenValue: ApprovalToken | undefined,
    reason: string,
    checks: (() => Promise<void>)[],
  ) {
    if (
      !manager.queryRunner?.isTransactionActive ||
      manager.connection !== this.source
    )
      throw new ForbiddenException(
        'Approval consumption requires the owning candidate transaction.',
      );
    if (!tokenValue)
      throw new ForbiddenException(
        'An exact inactive approval subject is required for validation.',
      );
    const token = validateApprovalToken(tokenValue),
      c: Context = { manager, actor, scope, reason, checks };
    const request = await this.request(c, token);
    await this.current(c, request, row);
    if (
      this.conflicts(request).has(actor.naturalPersonId) ||
      actor.subjectId === row.maker_subject_id
    )
      throw new ForbiddenException(
        'A maker or beneficiary cannot consume this inactive approval.',
      );
    const decisions: Decision[] = await manager.query(
      'SELECT * FROM finance_approval_decisions WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND request_id=$4 ORDER BY id',
      [...this.scope(c), request.id],
    );
    if (
      decisions.length !== request.subject.profile.requiredCheckers ||
      decisions.some((d) => d.action !== 'APPROVED_INACTIVE') ||
      !decisions.some(
        (d) =>
          d.actor_subject_id === actor.subjectId &&
          d.actor_natural_person_id === actor.naturalPersonId,
      )
    )
      throw new ForbiddenException(
        'The exact independent inactive quorum and a participating validator are required.',
      );
    const persons = new Set<string>();
    for (const decision of decisions) {
      const authority = await this.mandate(c, request, decision.mandate_id, {
        ...actor,
        subjectId: decision.actor_subject_id,
        naturalPersonId: decision.actor_natural_person_id,
      });
      const hash = financeConfigurationHash({
        requestHash: request.request_hash,
        mandateId: decision.mandate_id,
        mandateHash: authority.hash,
        actorSubjectId: decision.actor_subject_id,
        actorNaturalPersonId: decision.actor_natural_person_id,
        representedNaturalPersonId: authority.represented,
        action: decision.action,
      });
      if (
        authority.hash !== decision.mandate_hash ||
        authority.represented !== decision.represented_natural_person_id ||
        hash !== decision.decision_hash ||
        persons.has(decision.actor_natural_person_id) ||
        persons.has(authority.represented)
      )
        throw new ConflictException(
          'Approval authority or independent representation changed after decision.',
        );
      persons.add(decision.actor_natural_person_id);
      persons.add(authority.represented);
      checks.push(authority.verify);
    }
    await manager.query(
      "UPDATE finance_approval_requests SET state='CONSUMED_INACTIVE',consumed_subject_id=$5,consumed_natural_person_id=$6 WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND id=$4",
      [...this.scope(c), request.id, actor.subjectId, actor.naturalPersonId],
    );
    await this.event(c, request, null, 'CONSUMED_INACTIVE');
    checks.push(() => this.fresh(c, request));
  }

  /** One scoped, read-only snapshot. No repair, approvals, exports or bank data. */
  async readAudit(
    actor: FinanceConfigurationActor,
    scope: FinanceBookSelection,
    tokenValue: ApprovalToken,
  ) {
    ({ actor, scope } = this.identities(actor, scope));
    const token = validateApprovalToken(tokenValue);
    return this.source.transaction(async (manager) => {
      await manager.query('SET TRANSACTION READ ONLY');
      const [result] = await manager.query(
        `SELECT r.id,r.candidate_id,r.candidate_hash,r.request_hash,r.beneficiary_hash,r.state,r.profile_id,r.profile_hash,r.currency,r.amount::text,r.expires_at,
        COALESCE((SELECT jsonb_agg(jsonb_build_object('id',e.id,'action',e.action,'requestHash',e.request_hash,'occurredAt',e.occurred_at) ORDER BY e.occurred_at,e.id) FROM finance_approval_events e WHERE e.tenant_id=r.tenant_id AND e.legal_entity_id=r.legal_entity_id AND e.book_id=r.book_id AND e.request_id=r.id),'[]'::jsonb) AS events
        FROM finance_approval_requests r JOIN finance_accounting_books b ON b.id=r.book_id AND b.tenant_id=r.tenant_id AND b.legal_entity_id=r.legal_entity_id JOIN finance_legal_entities l ON l.id=r.legal_entity_id AND l.tenant_id=r.tenant_id
        WHERE r.tenant_id=$1 AND r.legal_entity_id=$2 AND r.book_id=$3 AND r.id=$4 AND r.request_hash=$5 AND r.beneficiary_hash=$6 AND b.state IN ('DRAFT','ACTIVE') AND l.state IN ('DRAFT','ACTIVE')
        AND EXISTS (SELECT 1 FROM finance_journal_candidate_authorities a WHERE a.tenant_id=r.tenant_id AND a.legal_entity_id=r.legal_entity_id AND a.book_id=r.book_id AND a.subject_id=$7 AND a.natural_person_id=$8 AND a.permission='READ_CANDIDATE_AUDIT' AND a.state='ENABLED' AND a.revoked_at IS NULL AND a.valid_from<=statement_timestamp() AND (a.valid_to IS NULL OR a.valid_to>statement_timestamp()))`,
        [
          actor.tenantId,
          scope.legalEntityId,
          scope.bookId,
          token.requestId,
          token.requestHash,
          token.beneficiaryHash,
          actor.subjectId,
          actor.naturalPersonId,
        ],
      );
      if (!result)
        throw new ForbiddenException(
          'The pinned inactive audit view is unavailable.',
        );
      return result;
    });
  }

  private async current(
    c: Context,
    request: ApprovalRequest,
    row: InactiveJournalCandidate,
  ) {
    if (
      row.id !== request.candidate_id ||
      row.subject_hash !== request.candidate_hash ||
      row.state !== 'PREPARED_INACTIVE' ||
      request.maker_subject_id !== row.maker_subject_id ||
      request.maker_natural_person_id !== row.maker_natural_person_id ||
      request.currency !== row.currency
    )
      throw new ConflictException(
        'The exact prepared candidate subject changed.',
      );
    const profile = await this.profile(
      c,
      row,
      request.profile_id,
      request.profile_hash,
    );
    if (
      canonicalFinanceJson(profile) !==
      canonicalFinanceJson(request.subject.profile)
    )
      throw new ConflictException('Inactive approval profile changed.');
    const [{ amount }] = await c.manager.query(
      'SELECT sum(debit)::text AS amount FROM finance_journal_candidate_lines WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND candidate_id=$4',
      [...this.scope(c), row.id],
    );
    if (amount !== request.amount)
      throw new ConflictException('Complete candidate amount changed.');
    const [period] = await c.manager.query(
      "SELECT id FROM finance_draft_periods WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND id=$4 AND state='OPEN_FOR_VALIDATION' AND revision=$5 AND starts_on<=$6::date AND ends_before>$6::date FOR SHARE",
      [
        ...this.scope(c),
        row.period_id,
        row.period_revision,
        row.payload.accountingDate,
      ],
    );
    if (!period)
      throw new ConflictException(
        'The approval candidate period is sealed or stale.',
      );
  }
  private async profile(
    c: Context,
    row: InactiveJournalCandidate,
    id: string,
    hash: string,
  ): Promise<InactiveApprovalProfile> {
    const [release] = await c.manager.query(
      "SELECT *,effective_from::text AS effective_from,effective_to::text AS effective_to FROM finance_configuration_releases WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND id=$4 AND kind='APPROVAL_RULES' AND state='REVIEWED_INACTIVE' FOR SHARE",
      [...this.scope(c), id],
    );
    if (
      !release ||
      release.release_hash !== hash ||
      release.effective_from > row.payload.accountingDate ||
      (release.effective_to &&
        release.effective_to <= row.payload.accountingDate)
    )
      throw new ConflictException(
        'An exact applicable independently reviewed inactive approval profile is required.',
      );
    return validateApprovalProfile(release.payload, release.dependency_refs);
  }
  private async request(
    c: Context,
    token: ApprovalToken,
  ): Promise<ApprovalRequest> {
    const [r]: ApprovalRequest[] = await c.manager.query(
      'SELECT * FROM finance_approval_requests WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND id=$4 FOR UPDATE',
      [...this.scope(c), token.requestId],
    );
    if (
      !r ||
      r.state !== 'OPEN_INACTIVE' ||
      r.request_hash !== token.requestHash ||
      r.beneficiary_hash !== token.beneficiaryHash ||
      financeConfigurationHash(r.subject) !== r.request_hash ||
      financeConfigurationHash(normalizeBeneficiary(r.beneficiary)) !==
        r.beneficiary_hash
    )
      throw new ConflictException(
        'Approval scope, immutable subject, beneficiary or state differs.',
      );
    const bound = {
      tenantId: c.actor.tenantId,
      ...c.scope,
      candidateId: r.candidate_id,
      candidateHash: r.candidate_hash,
      profileId: r.profile_id,
      profileHash: r.profile_hash,
      profile: r.subject.profile,
      beneficiaryHash: r.beneficiary_hash,
      amount: r.amount,
      currency: r.currency,
      makerSubjectId: r.maker_subject_id,
      makerNaturalPersonId: r.maker_natural_person_id,
      expiresAt: r.expires_at.toISOString(),
    };
    if (canonicalFinanceJson(bound) !== canonicalFinanceJson(r.subject))
      throw new ConflictException(
        'Approval columns differ from the frozen scoped subject.',
      );
    await this.fresh(c, r);
    return r;
  }
  private async fresh(c: Context, r: ApprovalRequest) {
    const [current] = await c.manager.query(
      'SELECT id FROM finance_approval_requests WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND id=$4 AND expires_at>statement_timestamp()',
      [...this.scope(c), r.id],
    );
    if (!current)
      throw new ForbiddenException(
        'Inactive approval expired before completion.',
      );
  }
  private conflicts(r: ApprovalRequest) {
    return new Set([
      r.maker_natural_person_id,
      ...(r.beneficiary.mode === 'REFERENCED'
        ? r.beneficiary.naturalPersonIds
        : []),
    ]);
  }
  private async mandate(
    c: Context,
    r: ApprovalRequest,
    id: string,
    actor: FinanceConfigurationActor,
  ) {
    const read = async (ref: string): Promise<Mandate> => {
      const [m]: Mandate[] = await c.manager.query(
        "SELECT * FROM finance_approval_mandates WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND id=$4 AND state='ENABLED' AND revoked_at IS NULL AND valid_from<=statement_timestamp() AND (valid_to IS NULL OR valid_to>statement_timestamp()) FOR SHARE",
        [...this.scope(c), ref],
      );
      if (!m)
        throw new ForbiddenException(
          'Current scoped approval mandate and delegation are required.',
        );
      return m;
    };
    const leaf = await read(id),
      root = leaf.delegated_from_id ? await read(leaf.delegated_from_id) : leaf;
    if (
      leaf.subject_id !== actor.subjectId ||
      leaf.natural_person_id !== actor.naturalPersonId ||
      leaf.role_code !== r.subject.profile.roleCode ||
      leaf.currency !== r.currency ||
      candidateAmount(leaf.max_amount, 12).units <
        candidateAmount(r.amount, 12).units ||
      this.conflicts(r).has(leaf.natural_person_id) ||
      this.conflicts(r).has(root.natural_person_id) ||
      leaf.subject_id === r.maker_subject_id ||
      root.subject_id === r.maker_subject_id
    )
      throw new ForbiddenException(
        'Mandate identity, role, entire amount/currency or person-level segregation fails.',
      );
    if (
      leaf.delegated_from_id &&
      (root.delegated_from_id !== null ||
        root.natural_person_id === leaf.natural_person_id ||
        root.role_code !== leaf.role_code ||
        root.currency !== leaf.currency ||
        candidateAmount(root.max_amount, 12).units <
          candidateAmount(leaf.max_amount, 12).units ||
        root.valid_from > leaf.valid_from ||
        (root.valid_to && (!leaf.valid_to || root.valid_to < leaf.valid_to)))
    )
      throw new ForbiddenException(
        'Only a bounded direct delegation within the original mandate is supported.',
      );
    const snapshot = (m: Mandate) => ({
      ...m,
      valid_from: m.valid_from.toISOString(),
      valid_to: m.valid_to?.toISOString() ?? null,
      revoked_at: m.revoked_at?.toISOString() ?? null,
    });
    const hash = financeConfigurationHash({
      leaf: snapshot(leaf),
      root: snapshot(root),
    });
    return {
      represented: root.natural_person_id,
      hash,
      verify: async () => {
        const nowLeaf = await read(id),
          nowRoot = leaf.delegated_from_id
            ? await read(leaf.delegated_from_id)
            : nowLeaf;
        if (
          financeConfigurationHash({
            leaf: snapshot(nowLeaf),
            root: snapshot(nowRoot),
          }) !== hash
        )
          throw new ForbiddenException(
            'Approval mandate changed before completion.',
          );
      },
    };
  }
  private async candidate(
    c: Context,
    id: string,
  ): Promise<InactiveJournalCandidate> {
    const [row]: InactiveJournalCandidate[] = await c.manager.query(
      'SELECT * FROM finance_journal_candidates WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND id=$4 FOR UPDATE',
      [...this.scope(c), id],
    );
    if (!row)
      throw new ConflictException(
        'Candidate unavailable in selected Finance scope.',
      );
    return row;
  }
  private async event(
    c: Context,
    request: ApprovalRequest,
    decisionId: string | null,
    action: string,
  ) {
    await c.manager.query(
      'INSERT INTO finance_approval_events (tenant_id,legal_entity_id,book_id,request_id,decision_id,action,request_hash,actor_subject_id,actor_natural_person_id,reason) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
      [
        ...this.scope(c),
        request.id,
        decisionId,
        action,
        request.request_hash,
        c.actor.subjectId,
        c.actor.naturalPersonId,
        c.reason,
      ],
    );
  }
  private scope(c: Context) {
    return [c.actor.tenantId, c.scope.legalEntityId, c.scope.bookId];
  }
  private uuid(id: unknown) {
    if (typeof id !== 'string' || !FINANCE_UUID.test(id))
      throw new BadRequestException('An exact UUID is required.');
  }
  private reference(id: string, hash: string) {
    this.uuid(id);
    if (typeof hash !== 'string' || !APPROVAL_HASH.test(hash))
      throw new BadRequestException('An exact subject hash is required.');
  }
  private identities(
    actor: FinanceConfigurationActor,
    scope: FinanceBookSelection,
  ) {
    if (
      !actor ||
      actor.kind !== 'USER' ||
      ![
        actor.tenantId,
        actor.subjectId,
        actor.naturalPersonId,
        scope?.legalEntityId,
        scope?.bookId,
      ].every((id) => typeof id === 'string' && FINANCE_UUID.test(id))
    )
      throw new ForbiddenException(
        'Trusted human Finance identity and exact scope are required.',
      );
    return {
      actor: Object.freeze({
        kind: 'USER' as const,
        tenantId: actor.tenantId.toLowerCase(),
        subjectId: actor.subjectId.toLowerCase(),
        naturalPersonId: actor.naturalPersonId.toLowerCase(),
      }),
      scope: Object.freeze({
        legalEntityId: scope.legalEntityId.toLowerCase(),
        bookId: scope.bookId.toLowerCase(),
      }),
    };
  }
  private async command<T>(
    actor: FinanceConfigurationActor,
    scope: FinanceBookSelection,
    access: 'PREPARE_CANDIDATE' | { mandateId: string },
    reason: string,
    work: (c: Context) => Promise<T>,
  ): Promise<T> {
    ({ actor, scope } = this.identities(actor, scope));
    if (!candidateText(reason, 2000))
      throw new BadRequestException('A recorded approval reason is required.');
    try {
      return await this.source.transaction(async (manager) => {
        const params = [actor.tenantId, scope.legalEntityId, scope.bookId];
        const [book] = await manager.query(
          "SELECT id FROM finance_accounting_books WHERE tenant_id=$1 AND legal_entity_id=$2 AND id=$3 AND state IN ('DRAFT','ACTIVE') FOR UPDATE",
          params,
        );
        const [entity] = await manager.query(
          "SELECT id FROM finance_legal_entities WHERE tenant_id=$1 AND id=$2 AND state IN ('DRAFT','ACTIVE') FOR SHARE",
          params.slice(0, 2),
        );
        if (!book || !entity)
          throw new ForbiddenException(
            'Inactive Finance scope is unavailable.',
          );
        const table =
          typeof access === 'string'
            ? 'finance_journal_candidate_authorities'
            : 'finance_approval_mandates';
        const selector = typeof access === 'string' ? 'permission=$6' : 'id=$6';
        const args = [
          ...params,
          actor.subjectId,
          actor.naturalPersonId,
          typeof access === 'string' ? access : access.mandateId,
        ];
        const query = `SELECT id FROM ${table} WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND subject_id=$4 AND natural_person_id=$5 AND ${selector} AND state='ENABLED' AND revoked_at IS NULL AND valid_from<=statement_timestamp() AND (valid_to IS NULL OR valid_to>statement_timestamp()) ORDER BY id LIMIT 1 FOR SHARE`;
        const [grant] = await manager.query(query, args);
        if (!grant)
          throw new ForbiddenException(
            'Explicit current scoped approval authority is required.',
          );
        const c: Context = { manager, actor, scope, reason, checks: [] },
          result = await work(c);
        for (const verify of c.checks) await verify();
        if (
          !(await manager.query(query, args)).some(
            (r: { id: string }) => r.id === grant.id,
          )
        )
          throw new ForbiddenException(
            'Approval authority expired before completion.',
          );
        return result;
      });
    } catch (error) {
      if (
        (error as { driverError?: { code?: string } })?.driverError?.code ===
        '23505'
      )
        throw new ConflictException(
          'Approval subject or independent decision already exists.',
        );
      throw error;
    }
  }
}
