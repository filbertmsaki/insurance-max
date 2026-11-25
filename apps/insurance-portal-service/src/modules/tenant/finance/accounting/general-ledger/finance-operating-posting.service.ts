import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import {
  FinanceLedgerFoundationService,
  type FoundationActor,
} from './finance-ledger-foundation.service';
import {
  candidateAmount,
  type JournalCandidateLine,
} from '../journal-entries/finance-journal-candidate.types';
import { FinanceJournalCandidateService } from '../journal-entries/finance-journal-candidate.service';
import { FinanceApprovalService } from '../../governance/finance-approvals/finance-approval.service';
import {
  financeConfigurationHash as hash,
  FINANCE_UUID,
} from '../../foundation/finance-configuration/finance-configuration.types';
import { financialSnapshotValue } from './finance-ledger-foundation.types';
import type { FinanceBookSelection } from '../../foundation/finance-configuration/finance-scope.service';
import { operatingDimensions } from '../../foundation/finance-setup/finance-operating-dimensions';
import {
  activePostingBook,
  usesInsuranceMeasurement,
  ownedEvidence,
  glDeployment,
  inverseJournal,
  originalPosting,
  type ActivePostingBook,
  type PostingRequest,
} from './finance-book-request';
import { readNativeMovement, reversalSources } from './finance-native-sources';
import { recordPremiumMemo } from './finance-ifrs-premiums';
import type { Evidence } from './finance-gl-program';
import type { ChartRoleProposal } from '../../foundation/chart-of-accounts/finance-chart.types';

export interface OperatingLine {
  accountCode: string;
  accountType: string;
  debit?: string;
  credit?: string;
  customerId?: string | null;
  intermediaryCompanyId?: string | null;
}

export interface OperatingSource {
  sourceType: string;
  sourceId: string;
  sourceEventId: string;
  description: string;
  currencyCode: string;
  lines: OperatingLine[];
  dimensions?: Record<string, string> | null;
  branchId?: string | null;
}

@Injectable()
export class FinanceOperatingPostingService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly candidates: FinanceJournalCandidateService,
    private readonly approvals: FinanceApprovalService,
    private readonly ledger: FinanceLedgerFoundationService,
  ) {}

  async prepare(
    m: EntityManager,
    company: string,
    user: string | null,
    source: OperatingSource,
  ) {
    const [schema] = await m.query(
      "SELECT to_regclass('public.finance_operating_postings') IS NOT NULL AS present,to_regclass('public.finance_gl_premium_memos') IS NOT NULL AS premiums",
    );
    if (!schema.present) return null;
    const book = await activePostingBook(m, company);
    const fingerprint = hash({
      currency: source.currencyCode,
      sourceId: source.sourceId,
      lines: source.lines,
    });
    const [existing] = await m.query(
      "SELECT p.*,j.id journal_id FROM finance_operating_postings p LEFT JOIN finance_foundation_journals j ON j.candidate_id=p.candidate_id AND j.mode='LIVE' WHERE p.company_id=$1 AND p.source_type=$2 AND p.source_event_id=$3",
      [company, source.sourceType, source.sourceEventId],
    );
    if (existing) {
      if (
        (existing.snapshot.aggregateId ?? existing.source_id) !==
          source.sourceId ||
        existing.snapshot.currency !== source.currencyCode ||
        (existing.snapshot.vectorHash &&
          existing.snapshot.vectorHash !== fingerprint)
      )
        throw new ConflictException(
          'The accounting event was reused with different financial data.',
        );
      return {
        id: existing.journal_id ?? existing.candidate_id,
        accountingStatus: existing.journal_id ? 'POSTED' : 'AWAITING_APPROVAL',
      };
    }
    if (
      schema.premiums &&
      ['WRITE_OFF', 'INVOICE'].includes(source.sourceType)
    ) {
      const [owner] = await m.query(
        'SELECT book_id FROM finance_gl_premium_memos WHERE company_id=$1 AND invoice_id=$2 LIMIT 1',
        [company, source.sourceId],
      );
      if (
        owner &&
        (!book ||
          book.book_id !== owner.book_id ||
          book.context.basis !== 'IFRS')
      )
        throw new ConflictException(
          'Restore the originating IFRS book for this premium invoice.',
        );
    }
    if (!book) {
      const [owned] = await m.query(
        "SELECT 1 FROM finance_operating_postings WHERE company_id=$1 AND (source_id=$2 OR snapshot->>'aggregateId'=$2::text) LIMIT 1",
        [company, source.sourceId],
      );
      if (owned)
        throw new ConflictException(
          'Restore the originating book before recording another movement for this document.',
        );
      return null;
    }
    const deployment = await glDeployment(m, book);
    if (
      deployment &&
      (deployment.action !== 'ENABLE' ||
        deployment.release_id !== book.release_id)
    )
      throw new ConflictException(
        'FIN-02 posting is paused for this company and book.',
      );
    if (!deployment && !['INVOICE', 'RECEIPT'].includes(source.sourceType)) {
      const [canonical] = await m.query(
        'SELECT 1 FROM finance_operating_postings WHERE company_id=$1 AND source_id=$2 LIMIT 1',
        [company, source.sourceId],
      );
      if (canonical)
        throw new ConflictException(
          'Enable FIN-02 to reverse the canonical original.',
        );
      return null;
    }
    const [legacy] = await m.query(
      "SELECT id FROM finance_journal_entries WHERE company_id=$1 AND source_type=ANY($2::text[]) AND source_id=$3 AND (source_type<>'CLAIM_RECOVERY_RECEIPT' OR source_event_id=$4) LIMIT 1",
      [
        company,
        [
          source.sourceType,
          reversalSources[source.sourceType]?.[0] ?? source.sourceType,
        ],
        source.sourceId,
        source.sourceEventId,
      ],
    );
    if (legacy)
      throw new ConflictException(
        'This source already has a legacy journal. Reconcile its existing accounting entry.',
      );
    if (!user)
      throw new ForbiddenException(
        'A scoped preparer must record the accounting request.',
      );
    const scope = { legalEntityId: book.legal_entity_id, bookId: book.book_id };
    const actor = await this.ledger.resolveIdentity(
      { id: user, companyId: company },
      scope,
      m,
    );
    const { doc, event, kind, effect, reversal } = await readNativeMovement(
      m,
      company,
      book.timezone,
      source,
    );
    if (
      kind === 'INVOICE' &&
      doc.invoice_type === 'PREMIUM' &&
      usesInsuranceMeasurement(book)
    ) {
      if (deployment?.action !== 'ENABLE')
        throw new ConflictException(
          'Enable the IFRS book before recording its premium memorandum.',
        );
      return this.ledger.withWorkflowAuthority(
        actor,
        scope,
        'PREPARE',
        source.description,
        () =>
          recordPremiumMemo(
            m,
            book,
            source,
            doc.date,
            reversal,
            actor.subjectId,
          ),
        m,
      );
    }
    if (reversal) {
      const orig = await originalPosting(m, book, kind, source.sourceId);
      if (
        doc.date < orig.original_date ||
        orig.snapshot.currency !== source.currencyCode
      )
        throw new ConflictException(
          'A reversal must follow its original in the same currency.',
        );
      return this.submit(m, actor, book, {
        type: source.sourceType,
        id: source.sourceId,
        event: source.sourceEventId,
        description: source.description,
        journal: inverseJournal(orig),
        snapshot: {
          ...orig.snapshot,
          transactionDate: doc.date,
          originalSourceType: kind,
          vectorHash: fingerprint,
          originalJournalId: orig.journal_id,
        },
      });
    }
    const config = book.context;
    const premiumCash =
      kind === 'RECEIPT' &&
      doc.invoice_type === 'PREMIUM' &&
      usesInsuranceMeasurement(book);
    const postingEvent = premiumCash ? 'PREMIUM_RECEIPT_POSTED' : event;
    let premiumMemoId: string | undefined;
    if (premiumCash) {
      const [memo] = await m.query(
        `SELECT i.id FROM finance_gl_premium_memos i WHERE i.book_id=$1 AND i.invoice_id=$2 AND i.event_type='ISSUED' AND NOT EXISTS (SELECT 1 FROM finance_gl_premium_memos v WHERE v.book_id=i.book_id AND v.invoice_id=i.invoice_id AND v.event_type='VOIDED')`,
        [book.book_id, doc.billing_invoice_id],
      );
      if (!memo)
        throw new ConflictException(
          'Reconcile the premium invoice to its billing memorandum before posting the collection.',
        );
      premiumMemoId = memo.id;
    }
    const matches = config.allowedComponents.filter(
      (x) =>
        x.origin === 'INSURANCE_PORTAL_FINANCE' &&
        x.sourceEventType === postingEvent &&
        x.factKind === kind &&
        x.owner === 'FINANCE' &&
        x.effect === effect,
    );
    if (
      matches.length !== 1 ||
      (kind === 'INVOICE' &&
        doc.invoice_type === 'PREMIUM' &&
        config.basis === 'IFRS')
    )
      throw new ConflictException(
        'An exact reviewed accounting component for this document and accounting basis is required.',
      );
    const component = matches[0],
      scale = config.currencyScales[doc.currency];
    if (doc.currency !== source.currencyCode)
      throw new ConflictException(
        'The source currency differs from its accounting request.',
      );
    const id = doc.movement_id ?? source.sourceId;
    let bankProof:
      | {
          bankSettlementId: string;
          bankSettlementHash: string;
          bankReference: string;
        }
      | undefined;
    if (kind === 'REFUND' || kind === 'COMMISSION_PAYMENT') {
      const [settled] = await m.query(
        'SELECT id,subject_hash,attestation,bank_reference FROM finance_gl_bank_settlements WHERE book_id=$1 AND company_id=$2 AND source_type=$3 AND source_id=$4 FOR SHARE',
        [book.book_id, company, kind, id],
      );
      if (
        !settled ||
        hash(settled.attestation) !== settled.subject_hash ||
        settled.attestation.currency !== doc.currency ||
        settled.attestation.settlementAccount !== doc.settlement_account_code ||
        candidateAmount(settled.attestation.amount, scale).units !==
          candidateAmount(doc.amount, scale).units
      )
        throw new ConflictException(
          'The paid source differs from its verified bank settlement.',
        );
      bankProof = {
        bankSettlementId: settled.id,
        bankSettlementHash: settled.subject_hash,
        bankReference: settled.bank_reference,
      };
    }
    const snapshot = {
      ...bankProof,
      description: source.description,
      companyId: company,
      sourceId: id,
      aggregateId: source.sourceId,
      eventType: postingEvent,
      ...(premiumMemoId
        ? { premiumMemoId, invoiceId: doc.billing_invoice_id }
        : {}),
      reference: doc.reference,
      amount: doc.amount,
      currency: doc.currency,
      transactionDate: doc.date,
      customerId: doc.customer_id ?? null,
      vectorHash: fingerprint,
      ...(doc.invoice_id
        ? { invoiceId: doc.invoice_id, evidence: doc.evidence }
        : {}),
    };
    const mapping = component.sourceMapping;
    if (
      !mapping ||
      financialSnapshotValue(snapshot, mapping.amountPath) !== doc.amount ||
      financialSnapshotValue(snapshot, mapping.datePath) !== doc.date ||
      financialSnapshotValue(snapshot, mapping.currencyPath) !== doc.currency ||
      financialSnapshotValue(snapshot, mapping.companyPath) !== company ||
      financialSnapshotValue(snapshot, mapping.aggregatePath) !== id
    )
      throw new ConflictException(
        'The posting rule must match the originating document.',
      );
    const [chart] = await m.query(
      'SELECT payload FROM finance_configuration_releases WHERE id=$1 AND release_hash=$2',
      [config.chartReleaseId, config.chartReleaseHash],
    );
    const roles: ChartRoleProposal[] = chart.payload.proposal.roles;
    const dimensions = await operatingDimensions(
      m,
      book,
      doc.date,
      doc.currency,
      doc.customer_id ?? null,
      doc.branch_id ?? null,
      doc.finance_dimensions ?? {},
    );
    if (deployment?.action === 'ENABLE' && !dimensions.BRANCH)
      throw new ConflictException(
        'Select the reviewed business branch on the originating transaction.',
      );
    const lines: JournalCandidateLine[] = [];
    for (const line of source.lines) {
      const dr = candidateAmount(line.debit ?? '0', scale),
        cr = candidateAmount(line.credit ?? '0', scale);
      if (!dr.units && !cr.units) continue;
      const allowed = dr.units ? component.debitRoles : component.creditRoles;
      const eligible = roles.filter(
        (r) =>
          allowed.includes(r.code) &&
          (premiumCash && cr.units > 0n
            ? ['ASSET', 'LIABILITY'].includes(r.accountType)
            : r.accountType === line.accountType),
      );
      const cashLine =
        kind === 'RECEIPT'
          ? !!dr.units
          : kind === 'REINSURANCE_SETTLEMENT'
            ? doc.settlement_type === 'CLAIM_RECOVERY'
              ? !!dr.units
              : !!cr.units
            : ['REFUND', 'COMMISSION_PAYMENT', 'CLAIM_DISBURSEMENT'].includes(
                kind,
              ) && !!cr.units;
      const code = cashLine ? doc.settlement_account_code : line.accountCode;
      const candidates =
        !cashLine && doc.settlement_account_code
          ? eligible.filter(
              (r) =>
                !book.controls.paymentMethods.some(
                  (method) => method.accountCode === r.accountCode,
                ),
            )
          : eligible;
      const exact = eligible.filter((r) => r.accountCode === code);
      const choices =
        premiumCash && cr.units > 0n
          ? candidates
          : exact.length ||
              cashLine ||
              (kind === 'INVOICE' && line.accountType === 'LIABILITY')
            ? exact
            : candidates;
      if (choices.length !== 1)
        throw new ConflictException(
          'Select an unambiguous approved posting role for ' +
            line.accountCode +
            '.',
        );
      if (
        deployment?.action === 'ENABLE' &&
        choices[0].accountType === 'EXPENSE' &&
        choices[0].accountCode?.startsWith('6') &&
        !dimensions.COST_CENTRE
      )
        throw new ConflictException(
          'Select a cost centre for the operating expense.',
        );
      lines.push({
        lineKey: 'L' + (lines.length + 1),
        roleCode: choices[0].code,
        debit: dr.stored,
        credit: cr.stored,
        dimensions,
      });
    }
    if (
      lines.reduce((n, l) => n + candidateAmount(l.debit, scale).units, 0n) !==
      candidateAmount(doc.amount, scale).units
    )
      throw new ConflictException(
        'The source document total differs from the journal vector.',
      );
    return this.submit(m, actor, book, {
      type: kind,
      id,
      event: source.sourceEventId,
      description: source.description,
      snapshot,
      journal: {
        economicOrigin: component.origin,
        economicComponent: component.component,
        economicSourceId: id,
        sourceRevision: '1',
        correctionOf: null,
        lines,
      },
    });
  }

  async submit(
    m: EntityManager,
    actor: FoundationActor,
    book: ActivePostingBook,
    request: PostingRequest,
  ) {
    const ids = [book.tenant_id, book.legal_entity_id, book.book_id],
      scope = { legalEntityId: ids[1], bookId: ids[2] },
      config = book.context;
    const date = request.snapshot.transactionDate,
      currency = request.snapshot.currency;
    const adjustment = request.snapshot.adjustmentPeriodId ?? null;
    if (
      adjustment !== null &&
      (typeof adjustment !== 'string' ||
        !FINANCE_UUID.test(adjustment) ||
        !(
          request.type === 'GL_REVERSAL' ||
          (request.type === 'GL_VOUCHER' &&
            request.snapshot.component === 'MANUAL')
        ))
    )
      throw new ConflictException(
        'Select an adjustment period for a manual journal or reversal.',
      );
    const [period] = await m.query(
      `SELECT d.id,d.revision,p.period_code FROM finance_draft_periods d JOIN finance_foundation_periods p ON p.book_id=d.book_id AND p.mode='LIVE' AND p.state='OPEN' AND p.starts_on<=$4 AND p.ends_before>$4
       WHERE d.tenant_id=$1 AND d.legal_entity_id=$2 AND d.book_id=$3 AND d.state='OPEN_FOR_VALIDATION' AND d.starts_on<=$4 AND d.ends_before>$4 AND (to_jsonb(d)->>'adjustment_period_id') IS NOT DISTINCT FROM $5::text
       AND (($5::text IS NULL AND p.period_kind='REGULAR') OR (p.period_kind='ADJUSTMENT' AND p.id::text=$5)) FOR SHARE OF p,d`,
      [...ids, date, adjustment],
    );
    if (!period)
      throw new ConflictException(
        'Open the ledger and journal validation period for this accounting date.',
      );
    const candidate = await this.candidates.prepareInactive(
      actor,
      scope,
      {
        schema: 'FINANCE_JOURNAL_CANDIDATE_V1',
        periodId: period.id,
        periodRevision: period.revision,
        accountingDate: date,
        chartReleaseId: config.chartReleaseId,
        chartReleaseHash: config.chartReleaseHash,
        currency,
        decimalScale: config.currencyScales[currency],
        ...request.journal,
      },
      request.description,
      m,
      request.supersedes,
    );
    const [profile] = await m.query(
      "SELECT r.id,r.release_hash FROM jsonb_array_elements($1::jsonb) pin JOIN finance_configuration_releases r ON r.id::text=pin->>'id' AND r.release_hash=pin->>'hash' WHERE r.kind='APPROVAL_RULES'",
      [JSON.stringify(book.controls.configurationPins)],
    );
    if (!profile)
      throw new ConflictException(
        'Select the independently reviewed journal approval profile.',
      );
    const token = await this.approvals.requestInactive(
      actor,
      scope,
      candidate.id,
      candidate.subject_hash,
      profile.id,
      profile.release_hash,
      {
        mode: 'NOT_APPLICABLE',
        reason:
          'This request records ledger entries. Payment authorization belongs to the originating payment workflow.',
      },
      request.description,
      m,
    );
    const snapshot = {
      ...request.snapshot,
      ...(adjustment ? { adjustmentPeriodCode: period.period_code } : {}),
      candidateHash: candidate.subject_hash,
    };
    await m.query(
      `INSERT INTO finance_operating_postings(tenant_id,legal_entity_id,book_id,company_id,source_type,source_id,source_event_id,context_id,context_hash,snapshot,snapshot_hash,candidate_id,request_id)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        ...ids,
        book.company_id,
        request.type,
        request.id,
        request.event,
        book.context_id,
        book.context_hash,
        snapshot,
        hash(snapshot),
        candidate.id,
        token.requestId,
      ],
    );
    return {
      id: candidate.id,
      hash: candidate.subject_hash,
      accountingStatus: 'AWAITING_APPROVAL',
    };
  }

  async legacyDimensions(
    m: EntityManager,
    company: string,
    source: OperatingSource,
    date: string,
  ) {
    const [schema] = await m.query(
      "SELECT to_regclass('public.finance_operating_setups') IS NOT NULL AS present",
    );
    if (!schema.present) return null;
    const [book] = await m.query('SELECT * FROM finance_fin01_primary($1)', [
      company,
    ]);
    const customer = source.lines.find((l) => l.customerId)?.customerId ?? null;
    const scale = book.controls.currencyScales[source.currencyCode];
    for (const line of source.lines) {
      candidateAmount(line.debit ?? '0', scale);
      candidateAmount(line.credit ?? '0', scale);
    }
    return operatingDimensions(
      m,
      book,
      date,
      source.currencyCode,
      customer,
      source.branchId ?? null,
      source.dimensions ?? {},
    );
  }

  async pending(actor: FoundationActor, scope: FinanceBookSelection) {
    const [schema] = await this.db.query(
      "SELECT to_regclass('public.finance_gl_reopens') IS NOT NULL present",
    );
    const supplement = schema.present
      ? "(SELECT jsonb_build_object('reason',x.reason,'evidence',x.evidence) FROM finance_gl_reopens x WHERE x.candidate_id=p.candidate_id ORDER BY x.created_at DESC LIMIT 1)"
      : 'null::jsonb';
    return this.db.query(
      `SELECT p.candidate_id AS "candidateId",c.subject_hash AS hash,p.snapshot,${supplement} supplement,r.state,r.expires_at<=statement_timestamp() AS expired,r.maker_subject_id=$5 AS maker,(SELECT jsonb_agg(jsonb_build_object('account',l.account_code,'role',l.role_code,'debit',l.debit::text,'credit',l.credit::text,'dimensions',l.dimensions) ORDER BY l.line_key) FROM finance_journal_candidate_lines l WHERE l.candidate_id=c.id) lines,
      r.subject#>>'{profile,requiredCheckers}' AS "requiredCheckers", (SELECT count(*)::int FROM finance_approval_decisions d WHERE d.request_id=r.id) AS decisions
      FROM finance_operating_postings p JOIN LATERAL(SELECT req.* FROM finance_approval_requests req WHERE req.candidate_id=p.candidate_id ORDER BY req.expires_at DESC,req.id DESC LIMIT 1) r ON true JOIN finance_journal_candidates c ON c.id=p.candidate_id
      WHERE r.state NOT IN ('REJECTED_INACTIVE','CANCELLED_INACTIVE') AND p.tenant_id=$1 AND p.legal_entity_id=$2 AND p.book_id=$3 AND p.company_id=$4 AND EXISTS(SELECT 1 FROM finance_foundation_authorities a WHERE a.tenant_id=p.tenant_id AND a.legal_entity_id=p.legal_entity_id AND a.book_id=p.book_id AND a.subject_id=$5 AND a.natural_person_id=$6 AND a.capability='READ' AND a.revoked_at IS NULL AND a.valid_from<=now() AND (a.valid_to IS NULL OR a.valid_to>now())) AND NOT EXISTS(SELECT 1 FROM finance_foundation_journals j WHERE j.candidate_id=c.id AND j.mode='LIVE') ORDER BY c.created_at,c.id`,
      [
        actor.tenantId,
        scope.legalEntityId,
        scope.bookId,
        actor.sourceCompanyId,
        actor.subjectId,
        actor.naturalPersonId,
      ],
    );
  }

  async renew(
    actor: FoundationActor,
    scope: FinanceBookSelection,
    id: string,
    expectedHash: string,
    reason: string,
    evidence?: Evidence,
  ) {
    return this.db.transaction(async (m) => {
      const ids = [actor.tenantId, scope.legalEntityId, scope.bookId];
      await m.query(
        'SELECT id FROM finance_accounting_books WHERE tenant_id=$1 AND legal_entity_id=$2 AND id=$3 FOR UPDATE',
        ids,
      );
      const [r] = await m.query(
        `SELECT r.*,p.source_type,r.expires_at<=statement_timestamp() AS expired FROM finance_operating_postings p JOIN finance_approval_requests r ON r.candidate_id=p.candidate_id
        JOIN finance_journal_candidates c ON c.id=p.candidate_id AND c.state='PREPARED_INACTIVE'
        WHERE p.tenant_id=$1 AND p.legal_entity_id=$2 AND p.book_id=$3 AND p.company_id=$4 AND c.id=$5 AND c.subject_hash=$6
        ORDER BY r.expires_at DESC,r.id DESC LIMIT 1`,
        [...ids, actor.sourceCompanyId, id, expectedHash],
      );
      if (
        !r ||
        r.maker_subject_id !== actor.subjectId ||
        r.maker_natural_person_id !== actor.naturalPersonId
      )
        throw new ForbiddenException(
          'Only the original preparer can renew this accounting request.',
        );
      if (r.state === 'REJECTED_INACTIVE' && !r.source_type.startsWith('GL_')) {
        const book = await activePostingBook(m, actor.sourceCompanyId!);
        if (!book || book.book_id !== scope.bookId)
          throw new ConflictException('Select the originating active book.');
        await ownedEvidence(m, book, evidence);
        await m.query(
          'INSERT INTO finance_gl_reopens(request_id,candidate_id,actor_subject_id,evidence,reason) VALUES($1,$2,$3,$4,$5)',
          [r.id, id, actor.subjectId, evidence, reason],
        );
      } else {
        if (r.state !== 'OPEN_INACTIVE')
          throw new ConflictException(
            'This accounting request has a final decision.',
          );
        if (!r.expired) return { requestId: r.id };
      }
      return this.approvals.requestInactive(
        actor,
        scope,
        id,
        expectedHash,
        r.profile_id,
        r.profile_hash,
        r.beneficiary,
        reason,
        m,
      );
    });
  }

  async approve(
    actor: FoundationActor,
    scope: FinanceBookSelection,
    id: string,
    expectedHash: string,
    reason: string,
    reject = false,
  ) {
    return this.db.transaction(async (m) => {
      const ids = [actor.tenantId, scope.legalEntityId, scope.bookId];
      await m.query(
        'SELECT id FROM finance_accounting_books WHERE tenant_id=$1 AND legal_entity_id=$2 AND id=$3 FOR UPDATE',
        ids,
      );
      const [p] = await m.query(
        `SELECT p.*,r.id AS current_request,r.state AS request_state,c.subject_hash,c.state,r.request_hash,r.beneficiary_hash,r.currency,r.amount,r.subject,ctx.payload AS context
        FROM finance_operating_postings p JOIN finance_journal_candidates c ON c.id=p.candidate_id JOIN LATERAL(SELECT req.* FROM finance_approval_requests req WHERE req.candidate_id=p.candidate_id ORDER BY req.expires_at DESC,req.id DESC LIMIT 1) r ON true JOIN finance_foundation_documents ctx ON ctx.id=p.context_id
        WHERE p.tenant_id=$1 AND p.legal_entity_id=$2 AND p.book_id=$3 AND p.company_id=$4 AND p.candidate_id=$5 AND c.subject_hash=$6`,
        [...ids, actor.sourceCompanyId, id, expectedHash],
      );
      if (!p)
        throw new ConflictException(
          'The exact accounting request is unavailable.',
        );
      if (reject && p.state !== 'PREPARED_INACTIVE')
        throw new ConflictException(
          'A validated journal requires its posting or correction workflow.',
        );
      const [posted] = await m.query(
        "SELECT id FROM finance_foundation_journals WHERE candidate_id=$1 AND mode='LIVE'",
        [id],
      );
      if (posted) {
        if (reject)
          throw new ConflictException(
            'A posted journal requires a linked reversal.',
          );
        const [vote] = await m.query(
          "SELECT id FROM finance_approval_decisions WHERE request_id=$1 AND actor_subject_id=$2 AND actor_natural_person_id=$3 AND action='APPROVED_INACTIVE'",
          [p.current_request, actor.subjectId, actor.naturalPersonId],
        );
        if (!vote)
          throw new ForbiddenException(
            'Only a reviewer who approved this request can replay its approval.',
          );
        return { journalId: posted.id, reused: true };
      }
      if (p.request_state === 'REJECTED_INACTIVE') {
        if (reject) {
          const [v] = await m.query(
            "SELECT 1 FROM finance_approval_decisions WHERE request_id=$1 AND action='REJECTED_INACTIVE' AND actor_natural_person_id=$2",
            [p.current_request, actor.naturalPersonId],
          );
          if (v) return { state: 'REJECTED_INACTIVE', reused: true };
        }
        throw new ConflictException('This approval request was rejected.');
      }
      const token = {
        requestId: p.current_request,
        requestHash: p.request_hash,
        beneficiaryHash: p.beneficiary_hash,
      };
      if (p.state === 'PREPARED_INACTIVE') {
        const [already] = await m.query(
          'SELECT id,action FROM finance_approval_decisions WHERE request_id=$1 AND actor_natural_person_id=$2',
          [p.current_request, actor.naturalPersonId],
        );
        if (reject && already && already.action !== 'REJECTED_INACTIVE')
          throw new ConflictException(
            'This reviewer has already approved the request.',
          );
        if (!already) {
          const [mandate] = await m.query(
            `SELECT id FROM finance_approval_mandates WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND subject_id=$4 AND natural_person_id=$5 AND currency=$6 AND max_amount>=$7 AND role_code=$8 AND state='ENABLED' AND revoked_at IS NULL AND valid_from<=now() AND (valid_to IS NULL OR valid_to>now()) ORDER BY max_amount,id LIMIT 1`,
            [
              ...ids,
              actor.subjectId,
              actor.naturalPersonId,
              p.currency,
              p.amount,
              p.subject.profile.roleCode,
            ],
          );
          if (!mandate)
            throw new ForbiddenException(
              'A current independent approval mandate for this amount is required.',
            );
          await this.approvals.decideInactive(
            actor,
            scope,
            token,
            mandate.id,
            reject ? 'REJECTED_INACTIVE' : 'APPROVED_INACTIVE',
            reason,
            m,
          );
        }
        if (reject) return { state: 'REJECTED_INACTIVE' };
        const [count] = await m.query(
          "SELECT count(*)::int AS n FROM finance_approval_decisions WHERE request_id=$1 AND action='APPROVED_INACTIVE'",
          [p.current_request],
        );
        if (count.n < p.subject.profile.requiredCheckers)
          return {
            remainingApprovals: p.subject.profile.requiredCheckers - count.n,
          };
        await this.candidates.validateInactive(
          actor,
          scope,
          id,
          expectedHash,
          reason,
          token,
          m,
        );
      }
      let rate: { id: string; subject_hash: string } | undefined;
      if (
        p.snapshot.originalJournalId &&
        p.currency !== p.context.functionalCurrency
      ) {
        [rate] = await m.query(
          "SELECT rate_id id,rate_hash subject_hash FROM finance_foundation_journals WHERE book_id=$1 AND id=$2 AND mode='LIVE'",
          [scope.bookId, p.snapshot.originalJournalId],
        );
      } else if (p.currency !== p.context.functionalCurrency) {
        [rate] = await m.query(
          `SELECT d.id,d.subject_hash FROM finance_foundation_documents d JOIN finance_foundation_decisions e ON e.document_id=d.id AND e.state='REVIEWED'
          WHERE d.parent_id=$1 AND d.kind='EXCHANGE_RATE' AND d.payload->>'transactionCurrency'=$2 AND d.payload->>'rateDate'<=$3 AND d.payload->>'validTo'>$3
          ORDER BY d.payload->>'rateDate' DESC,d.version DESC,d.created_at DESC,d.id LIMIT 1`,
          [p.context_id, p.currency, p.snapshot.transactionDate],
        );
        if (!rate)
          throw new ConflictException(
            'Review a dated exchange rate before posting.',
          );
      }
      return this.ledger.acceptCandidate(
        actor,
        scope,
        {
          candidateId: id,
          candidateHash: expectedHash,
          contextId: p.context_id,
          contextHash: p.context_hash,
          rateId: rate?.id ?? null,
          rateHash: rate?.subject_hash ?? null,
          transactionDate: p.snapshot.transactionDate,
          mode: 'LIVE',
          source: {
            kind: p.source_type.startsWith('GL_')
              ? 'BOOK_VOUCHER'
              : 'OPERATING_DOCUMENT',
            reference: p.source_type.startsWith('GL_')
              ? p.snapshot.reference
              : p.source_id,
            evidenceHash: p.snapshot_hash,
          },
        },
        reason,
        m,
      );
    });
  }
}
