import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { verifyAcceptedSource } from './finance-accepted-source';
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
  requireUuid,
} from './finance-integration.controls';
import { candidateText } from './finance-journal-candidate.types';
import {
  BILLING_EVENT,
  BILLING_HOLDS,
  billingProfile,
  normalizeQuotationBilling,
  type QuotationBillingSnapshot,
} from './finance-quotation-billing.types';
import type { IntegrationScope } from './finance-integration.types';
import { APPROVAL_HASH } from './finance-approval.types';
type Actor = FinanceConfigurationActor;
type Row = Record<string, any>;
type Permission = 'PREPARE_BILLING' | 'REVIEW_BILLING' | 'READ_BILLING';
function identity(p: Actor): Actor {
  if (!p || p.kind !== 'USER')
    throw new ForbiddenException(
      'A trusted human billing identity is required.',
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

/** Inactive memoranda only. This service has no journal/payment dependency. */
@Injectable()
export class FinanceQuotationBillingService {
  constructor(@InjectDataSource() private readonly source: DataSource) {}
  private async grant(
    m: EntityManager,
    p: Actor,
    s: IntegrationScope,
    permission: Permission,
    lock = true,
  ) {
    const query = `SELECT * FROM finance_billing_authorities WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND subject_id=$4 AND natural_person_id=$5 AND permission=$6 AND state='ENABLED' AND revoked_at IS NULL AND valid_from<=statement_timestamp() AND (valid_to IS NULL OR valid_to>statement_timestamp()) ORDER BY id LIMIT 1${lock ? ' FOR SHARE' : ''}`,
      args = [
        p.tenantId,
        s.legalEntityId,
        s.bookId,
        p.subjectId,
        p.naturalPersonId,
        permission,
      ];
    const [g] = await m.query(query, args);
    if (!g)
      throw new ForbiddenException(
        'Current exact billing authority is required.',
      );
    const fingerprint = hash(integrationSnapshot(g));
    return {
      id: g.id,
      hash: fingerprint,
      verify: async () => {
        const [now] = await m.query(query, args);
        if (
          !now ||
          now.id !== g.id ||
          hash(integrationSnapshot(now)) !== fingerprint
        )
          throw new ForbiddenException(
            'Billing authority changed or expired before completion.',
          );
      },
    };
  }
  private async command<T>(
    p: Actor,
    s: IntegrationScope,
    perm: Permission,
    reason: string,
    run: (
      m: EntityManager,
      g: Awaited<ReturnType<FinanceQuotationBillingService['grant']>>,
    ) => Promise<T>,
  ) {
    if (!candidateText(reason, 2000))
      throw new BadRequestException(
        'An explicit billing evidence reason is required.',
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
      const g = await this.grant(m, p, s, perm),
        result = await run(m, g);
      await g.verify();
      return result;
    });
  }
  private async profile(
    m: EntityManager,
    p: Actor,
    s: IntegrationScope,
    id: string,
    expected: string,
  ) {
    const [r] = await m.query(
      "SELECT * FROM finance_configuration_releases WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND id=$4 AND release_hash=$5 AND kind='QUOTATION_BILLING_RULES' AND state='REVIEWED_INACTIVE' AND effective_from<=(statement_timestamp() AT TIME ZONE 'UTC')::date AND (effective_to IS NULL OR effective_to>(statement_timestamp() AT TIME ZONE 'UTC')::date) FOR SHARE",
      [p.tenantId, s.legalEntityId, s.bookId, id, expected],
    );
    if (!r)
      throw new ConflictException(
        'An exact current reviewed inactive billing profile is required.',
      );
    return billingProfile(r.payload, r.dependency_refs);
  }
  private async evidence(
    m: EntityManager,
    p: Actor,
    s: IntegrationScope,
    inboxId: string,
    snapshot: QuotationBillingSnapshot,
    rawHash: string,
    deliveryId: string | null = null,
  ) {
    return verifyAcceptedSource(
      m,
      p,
      s,
      inboxId,
      {
        eventType: BILLING_EVENT,
        factKind: 'QUOTATION_BILLING',
        aggregateType: 'QUOTATION',
        aggregateId: snapshot.quotationId,
        companyId: snapshot.sourceCompanyId,
        revision: snapshot.sourceRevision,
        snapshotHash: rawHash,
      },
      deliveryId,
    );
  }
  private async audit(
    m: EntityManager,
    p: Actor,
    s: IntegrationScope,
    b: Row,
    action: string,
    reason: string,
    decisionId?: string,
  ) {
    await m.query(
      'INSERT INTO finance_quotation_billing_audits(tenant_id,legal_entity_id,book_id,memo_id,decision_id,action,subject_hash,actor_subject_id,actor_natural_person_id,reason) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
      [
        p.tenantId,
        s.legalEntityId,
        s.bookId,
        b.id,
        decisionId ?? null,
        action,
        b.subject_hash,
        p.subjectId,
        p.naturalPersonId,
        reason,
      ],
    );
  }
  private result(b: Row, reused = false) {
    return {
      id: b.id,
      hash: b.subject_hash,
      sourceRevision: b.source_revision,
      reused,
      billingAuthority: 'MEMORANDUM_ONLY',
      recognitionOwner: 'UNASSIGNED_HELD',
      accountingState: 'HELD_INACTIVE',
      financialEffects: 0,
      holds: [...BILLING_HOLDS],
    };
  }
  async prepareInactive(
    p: Actor,
    s: IntegrationScope,
    input: {
      inboxId: string;
      profileId: string;
      profileHash: string;
      snapshot: unknown;
    },
    reason: string,
  ) {
    p = identity(p);
    s = integrationScope(s);
    requireUuid(input?.inboxId);
    requireUuid(input?.profileId);
    if (
      typeof input.profileHash !== 'string' ||
      !APPROVAL_HASH.test(input.profileHash)
    )
      throw new BadRequestException(
        'An exact billing profile hash is required.',
      );
    input = {
      inboxId: input.inboxId,
      profileId: input.profileId,
      profileHash: input.profileHash,
      snapshot: JSON.parse(canonicalFinanceJson(input.snapshot)),
    };
    const snapshot = normalizeQuotationBilling(input.snapshot),
      rawHash = hash(input.snapshot);
    return this.command(p, s, 'PREPARE_BILLING', reason, async (m, g) => {
      const policy = await this.profile(
        m,
        p,
        s,
        input.profileId,
        input.profileHash,
      );
      if (snapshot.lines.length > policy.maxLines)
        throw new BadRequestException(
          'The explicit billing line bound was exceeded.',
        );
      const [old] = await m.query(
        'SELECT * FROM finance_quotation_memoranda WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND inbox_id=$4',
        [p.tenantId, s.legalEntityId, s.bookId, input.inboxId],
      );
      const e = await this.evidence(
        m,
        p,
        s,
        input.inboxId,
        snapshot,
        rawHash,
        old?.delivery_id ?? null,
      );
      if (old) {
        if (
          old.profile_id !== input.profileId ||
          old.profile_hash !== input.profileHash ||
          old.source_snapshot_hash !== rawHash ||
          hash(old.subject) !== old.subject_hash ||
          hash(old.subject.snapshot) !== hash(snapshot)
        )
          throw new ConflictException(
            'An existing quotation revision has different immutable content.',
          );
        return this.result(old, true);
      }
      const [original] = await m.query(
        'SELECT id FROM finance_quotation_memoranda WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND source_system=$4 AND source_company_id=$5 AND quotation_id=$6 AND source_revision=$7',
        [
          p.tenantId,
          s.legalEntityId,
          s.bookId,
          e.source_system,
          snapshot.sourceCompanyId,
          snapshot.quotationId,
          snapshot.sourceRevision,
        ],
      );
      if (original)
        throw new ConflictException(
          'The economic quotation revision already has another source representation; reconciliation is required.',
        );
      let previousId: string | null = null;
      if (snapshot.sourceRevision > 1) {
        const [prev] = await m.query(
          'SELECT id FROM finance_quotation_memoranda WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND economic_root=$4 AND source_revision=$5 AND preview_id=$6',
          [
            p.tenantId,
            s.legalEntityId,
            s.bookId,
            e.economic_root,
            snapshot.sourceRevision - 1,
            e.previous_preview_id,
          ],
        );
        if (!prev)
          throw new ConflictException(
            'The preceding memorandum must exist; a late source does not invent an opening balance.',
          );
        previousId = prev.id;
      }
      const subject = {
        schema: 'FINANCE_QUOTATION_MEMORANDUM_V1',
        tenantId: p.tenantId,
        ...s,
        inboxId: input.inboxId,
        previewId: e.preview_id,
        deliveryId: e.delivery_id,
        economicRoot: e.economic_root,
        sourceRevision: snapshot.sourceRevision,
        previousId,
        profileId: input.profileId,
        profileHash: input.profileHash,
        rawSnapshotHash: rawHash,
        snapshot,
        maker: {
          subjectId: p.subjectId,
          naturalPersonId: p.naturalPersonId,
          grantId: g.id,
          grantHash: g.hash,
        },
        billingAuthority: 'MEMORANDUM_ONLY',
        recognitionOwner: 'UNASSIGNED_HELD',
        accountingState: 'HELD_INACTIVE',
        financialEffects: 0,
        holds: [...BILLING_HOLDS],
      };
      const b: Row = {
        id: randomUUID(),
        tenant_id: p.tenantId,
        legal_entity_id: s.legalEntityId,
        book_id: s.bookId,
        inbox_id: input.inboxId,
        preview_id: e.preview_id,
        delivery_id: e.delivery_id,
        economic_root: e.economic_root,
        source_system: e.source_system,
        source_company_id: snapshot.sourceCompanyId,
        quotation_id: snapshot.quotationId,
        source_revision: snapshot.sourceRevision,
        previous_id: previousId,
        profile_id: input.profileId,
        profile_hash: input.profileHash,
        source_snapshot: input.snapshot,
        source_snapshot_hash: rawHash,
        subject,
        subject_hash: hash(subject),
        maker_subject_id: p.subjectId,
        maker_natural_person_id: p.naturalPersonId,
        maker_grant_id: g.id,
        maker_grant_hash: g.hash,
        currency: snapshot.currency,
        decimal_scale: snapshot.decimalScale,
        tax_presentation: snapshot.taxPresentation,
        ...snapshot.components,
        billing_authority: 'MEMORANDUM_ONLY',
        recognition_owner: 'UNASSIGNED_HELD',
        accounting_state: 'HELD_INACTIVE',
        financial_effects: 0,
      };
      const keys = Object.keys(b);
      await m.query(
        `INSERT INTO finance_quotation_memoranda(${keys.join(',')}) VALUES(${keys.map((_, i) => '$' + (i + 1)).join(',')})`,
        keys.map((k) => b[k]),
      );
      for (const l of snapshot.lines)
        await m.query(
          'INSERT INTO finance_quotation_memorandum_lines(memo_id,line_key,description,gross,discount,tax,charges,total) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
          [
            b.id,
            l.key,
            l.description,
            l.gross,
            l.discount,
            l.tax,
            l.charges,
            l.total,
          ],
        );
      await this.audit(m, p, s, b, 'PREPARED_INACTIVE', reason);
      await this.profile(m, p, s, input.profileId, input.profileHash);
      return this.result(b);
    });
  }
  private async stored(
    m: EntityManager,
    p: Actor,
    s: IntegrationScope,
    id: string,
    expected?: string,
  ) {
    const [b] = await m.query(
      'SELECT * FROM finance_quotation_memoranda WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND id=$4',
      [p.tenantId, s.legalEntityId, s.bookId, id],
    );
    if (!b)
      throw new ForbiddenException(
        'The quotation memorandum is unavailable in this scope.',
      );
    const snap = normalizeQuotationBilling(b.subject.snapshot);
    if (
      (expected && expected !== b.subject_hash) ||
      hash(b.subject) !== b.subject_hash ||
      hash(b.source_snapshot) !== b.source_snapshot_hash ||
      hash(normalizeQuotationBilling(b.source_snapshot)) !== hash(snap)
    )
      throw new ConflictException(
        'Persisted quotation evidence or hash differs.',
      );
    const lines: Row[] = await m.query(
      'SELECT * FROM finance_quotation_memorandum_lines WHERE memo_id=$1 ORDER BY line_key',
      [b.id],
    );
    if (
      lines.length !== snap.lines.length ||
      snap.lines.some((l) => {
        const r = lines.find((r) => r.line_key === l.key);
        return (
          !r ||
          ['gross', 'discount', 'tax', 'charges', 'total'].some(
            (k) => r[k] !== l[k],
          ) ||
          r.description !== l.description
        );
      }) ||
      ['gross', 'discount', 'tax', 'charges', 'total'].some(
        (k) => b[k] !== snap.components[k],
      )
    )
      throw new ConflictException(
        'Stored memorandum component vector differs.',
      );
    return b;
  }
  /** Internal transaction-local verified reference for B14. Caller must enforce its own exact scoped authority. */
  async verifiedReference(
    m: EntityManager,
    p: Actor,
    s: IntegrationScope,
    id: string,
    expected?: string,
    current = true,
  ) {
    const b = await this.stored(m, p, s, id, expected);
    const [d] = await m.query(
      "SELECT * FROM finance_quotation_billing_decisions WHERE memo_id=$1 AND decision='REVIEWED_INACTIVE'",
      [id],
    );
    if (
      !d ||
      d.subject_hash !== b.subject_hash ||
      d.reviewer_natural_person_id === b.maker_natural_person_id
    )
      throw new ConflictException(
        'An independently reviewed inactive billing reference is required.',
      );
    await this.evidence(
      m,
      p,
      s,
      b.inbox_id,
      b.subject.snapshot,
      b.source_snapshot_hash,
      b.delivery_id,
    );
    if (current) {
      const [head] = await m.query(
        'SELECT max(source_revision)::integer AS revision FROM finance_source_event_previews WHERE tenant_id=$1 AND economic_root=$2',
        [p.tenantId, b.economic_root],
      );
      if (head.revision !== b.source_revision)
        throw new ConflictException(
          'The billing source is superseded; reconcile its pending assignments before new use.',
        );
    }
    return b;
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
    requireUuid(ref?.id);
    if (typeof ref.hash !== 'string' || !APPROVAL_HASH.test(ref.hash))
      throw new BadRequestException(
        'An exact memorandum hash is required for review.',
      );
    ref = { ...ref };
    if (!['REVIEWED_INACTIVE', 'REJECTED_INACTIVE'].includes(decision))
      throw new BadRequestException(
        'Only an explicit inactive review is supported.',
      );
    return this.command(p, s, 'REVIEW_BILLING', reason, async (m, g) => {
      const b = await this.stored(m, p, s, ref.id, ref.hash);
      if (
        p.subjectId === b.maker_subject_id ||
        p.naturalPersonId === b.maker_natural_person_id
      )
        throw new ForbiddenException(
          'An independent natural person must review quotation billing.',
        );
      const [old] = await m.query(
        'SELECT * FROM finance_quotation_billing_decisions WHERE memo_id=$1',
        [b.id],
      );
      if (old) {
        if (
          old.reviewer_subject_id !== p.subjectId ||
          old.reviewer_natural_person_id !== p.naturalPersonId ||
          old.decision !== decision
        )
          throw new ConflictException(
            'The immutable billing review already has another decision.',
          );
        return { ...this.result(b, true), decisionId: old.id, decision };
      }
      const mg = await this.grant(
        m,
        {
          kind: 'USER',
          tenantId: p.tenantId,
          subjectId: b.maker_subject_id,
          naturalPersonId: b.maker_natural_person_id,
        },
        s,
        'PREPARE_BILLING',
      );
      if (mg.id !== b.maker_grant_id || mg.hash !== b.maker_grant_hash)
        throw new ConflictException(
          'The frozen billing maker authority changed.',
        );
      await this.profile(m, p, s, b.profile_id, b.profile_hash);
      await this.evidence(
        m,
        p,
        s,
        b.inbox_id,
        b.subject.snapshot,
        b.source_snapshot_hash,
        b.delivery_id,
      );
      const [head] = await m.query(
        'SELECT max(source_revision)::integer AS revision FROM finance_source_event_previews WHERE tenant_id=$1 AND economic_root=$2',
        [p.tenantId, b.economic_root],
      );
      if (head.revision !== b.source_revision)
        throw new ConflictException(
          'The source revision is superseded; historical billing remains preserved.',
        );
      const id = randomUUID();
      await m.query(
        'INSERT INTO finance_quotation_billing_decisions(id,tenant_id,legal_entity_id,book_id,memo_id,subject_hash,reviewer_subject_id,reviewer_natural_person_id,reviewer_grant_id,reviewer_grant_hash,decision) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
        [
          id,
          p.tenantId,
          s.legalEntityId,
          s.bookId,
          b.id,
          b.subject_hash,
          p.subjectId,
          p.naturalPersonId,
          g.id,
          g.hash,
          decision,
        ],
      );
      await this.audit(m, p, s, b, decision, reason, id);
      await mg.verify();
      await this.profile(m, p, s, b.profile_id, b.profile_hash);
      return { ...this.result(b), decisionId: id, decision };
    });
  }
  async readInactive(p: Actor, s: IntegrationScope, id: string) {
    p = identity(p);
    s = integrationScope(s);
    requireUuid(id);
    return this.source.transaction('REPEATABLE READ', async (m) => {
      await m.query('SET TRANSACTION READ ONLY');
      const g = await this.grant(m, p, s, 'READ_BILLING', false);
      await integrationBook(
        m,
        { kind: 'WORKER', tenantId: p.tenantId, subjectId: p.subjectId },
        s,
        false,
      );
      const b = await this.stored(m, p, s, id);
      const [d] = await m.query(
        'SELECT id,decision FROM finance_quotation_billing_decisions WHERE memo_id=$1',
        [id],
      );
      const [head] = await m.query(
        'SELECT max(source_revision)::integer AS revision FROM finance_source_event_previews WHERE tenant_id=$1 AND economic_root=$2',
        [p.tenantId, b.economic_root],
      );
      const history = await m.query(
        'SELECT action,actor_subject_id,actor_natural_person_id,reason,created_at FROM finance_quotation_billing_audits WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND memo_id=$4 ORDER BY created_at,id',
        [p.tenantId, s.legalEntityId, s.bookId, id],
      );
      await g.verify();
      return {
        ...this.result(b),
        snapshot: b.subject.snapshot,
        decision: d?.decision ?? 'PREPARED_INACTIVE',
        superseded: head.revision > b.source_revision,
        history,
      };
    });
  }
}
