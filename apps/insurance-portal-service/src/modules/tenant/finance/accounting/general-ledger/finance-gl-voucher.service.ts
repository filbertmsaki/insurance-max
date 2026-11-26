import { ConflictException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { EntityManager } from 'typeorm';
import {
  FinanceLedgerFoundationService,
  type FoundationActor,
} from './finance-ledger-foundation.service';
import { FinanceOperatingPostingService } from './finance-operating-posting.service';
import {
  activePostingBook,
  glDeployment,
  inverseJournal,
  originalPosting,
  bookChart,
  ownedEvidence,
  type ActivePostingBook,
} from './finance-book-request';
import {
  FINANCE_UUID,
  financeConfigurationHash as hash,
  isFinanceDate,
} from '../../foundation/finance-configuration/finance-configuration.types';
import type { FinanceBookSelection } from '../../foundation/finance-configuration/finance-scope.service';
import type { FinanceChartProposal } from '../../foundation/chart-of-accounts/finance-chart.types';
import { operatingDimensions } from '../../foundation/finance-setup/finance-operating-dimensions';
import {
  candidateAmount,
  candidateText,
  type JournalCandidateLine,
} from '../journal-entries/finance-journal-candidate.types';
import {
  fromMinor,
  invalid,
  type Evidence,
  type VoucherInput,
} from './finance-gl-program';

export async function workflowBook(
  m: EntityManager,
  a: FoundationActor,
  s: FinanceBookSelection,
  readOnly = false,
) {
  const b = await activePostingBook(
    m,
    a.sourceCompanyId!,
    readOnly ? 'SHARE' : 'UPDATE',
    s.bookId,
  );
  if (
    !b ||
    b.book_id !== s.bookId ||
    b.legal_entity_id !== s.legalEntityId ||
    b.tenant_id !== a.tenantId
  )
    throw new ConflictException(
      'Select an activated accounting book belonging to this company.',
    );
  return b;
}
export async function voucherLines(
  m: EntityManager,
  b: ActivePostingBook,
  kind: string,
  v: Pick<VoucherInput, 'date' | 'currency' | 'lines'>,
  chart: FinanceChartProposal,
  rule = b.context.allowedComponents.find(
    (c) =>
      c.origin === 'FIN02_GL' &&
      c.component === kind &&
      c.owner === 'FINANCE' &&
      c.sourceEventType === null &&
      ['CASH', 'ORDINARY'].includes(c.effect),
  ),
) {
  if (!rule)
    throw new ConflictException(
      'Review and activate a FIN02_GL accounting component for ' + kind + '.',
    );
  if (!Array.isArray(v.lines) || v.lines.length < 2 || v.lines.length > 1000)
    invalid('Enter between two and 1,000 journal lines.');
  const scale = b.context.currencyScales[v.currency];
  let debit = 0n,
    credit = 0n;
  const lines: JournalCandidateLine[] = [];
  const cached = new Map<string, Record<string, string>>();
  for (const l of v.lines) {
    if (!l || !l.dimensions || !FINANCE_UUID.test(l.dimensions.BRANCH))
      invalid('A reviewed branch is mandatory on every voucher line.');
    const role = chart.roles.find((r) => r.code === l.role),
      account = chart.accounts.find((a) => a.code === role?.accountCode);
    if (!role || !account?.posting)
      throw new ConflictException(
        'Select a posting account role from the reviewed chart.',
      );
    if (
      (role.requiredDimensions.includes('COST_CENTRE') ||
        (account.type === 'EXPENSE' && account.code.startsWith('6'))) &&
      !l.dimensions.COST_CENTRE
    )
      invalid('An operating expense needs a cost centre.');
    const dr = candidateAmount(l.debit, scale),
      cr = candidateAmount(l.credit, scale);
    const isDebit = dr.units > 0n;
    const isCredit = cr.units > 0n;
    if (
      isDebit === isCredit ||
      !(isDebit ? rule.debitRoles : rule.creditRoles).includes(l.role)
    )
      invalid(
        'Enter a positive one-sided amount against a role authorized for that side.',
      );
    const key = hash(l.dimensions);
    let dimensions = cached.get(key);
    if (!dimensions) {
      dimensions = await operatingDimensions(
        m,
        b,
        v.date,
        v.currency,
        null,
        l.dimensions.BRANCH,
        l.dimensions,
      );
      cached.set(key, dimensions);
    }
    debit += dr.units;
    credit += cr.units;
    lines.push({
      lineKey: 'L' + (lines.length + 1),
      roleCode: l.role,
      debit: dr.stored,
      credit: cr.stored,
      dimensions,
    });
  }
  if (debit <= 0n || debit !== credit)
    invalid('Journal debits and credits must balance.');
  return { lines, amount: fromMinor(debit / 10n ** BigInt(12 - scale), scale) };
}
@Injectable()
export class FinanceGlVoucherService {
  constructor(
    private readonly ledger: FinanceLedgerFoundationService,
    private readonly posting: FinanceOperatingPostingService,
  ) {}
  saveDraft(
    a: FoundationActor,
    s: FinanceBookSelection,
    v: VoucherInput,
    id?: string,
    revision?: number,
  ) {
    return this.ledger.withWorkflowAuthority(
      a,
      s,
      'PREPARE',
      'Save general journal draft',
      async ({ manager: m }) => {
        const b = await workflowBook(m, a, s);
        if (
          !v ||
          !Array.isArray(v.lines) ||
          v.lines.length > 1000 ||
          JSON.stringify(v).length > 1000000
        )
          invalid('Enter a bounded voucher draft.');
        if (!id) {
          const [r] = await m.query(
            'INSERT INTO finance_gl_drafts(book_id,maker_subject_id,maker_person_id,revision,input) VALUES($1,$2,$3,1,$4) RETURNING id,revision',
            [b.book_id, a.subjectId, a.naturalPersonId, v],
          );
          return r;
        }
        const [r] = await m.query(
          'WITH changed AS (UPDATE finance_gl_drafts SET input=$1,revision=revision+1,updated_at=statement_timestamp() WHERE book_id=$2 AND id=$3 AND maker_subject_id=$4 AND maker_person_id=$5 AND revision=$6 AND candidate_id IS NULL RETURNING id,revision) SELECT * FROM changed',
          [v, b.book_id, id, a.subjectId, a.naturalPersonId, revision],
        );
        if (!r)
          throw new ConflictException(
            'Refresh the draft before editing this version.',
          );
        return r;
      },
    );
  }
  manual(
    a: FoundationActor,
    s: FinanceBookSelection,
    v: VoucherInput,
    draft?: { id: string; revision: number },
  ) {
    return this.ledger.withWorkflowAuthority(
      a,
      s,
      'PREPARE',
      v?.description,
      async ({ manager: m }) => {
        const b = await workflowBook(m, a, s);
        if (!candidateText(v.reference, 120))
          invalid('Enter the external voucher reference.');
        if (draft) {
          const [d] = await m.query(
            'SELECT * FROM finance_gl_drafts WHERE book_id=$1 AND id=$2 AND maker_subject_id=$3 AND maker_person_id=$4 FOR UPDATE',
            [b.book_id, draft.id, a.subjectId, a.naturalPersonId],
          );
          if (!d || draft.revision !== d.revision || hash(d.input) !== hash(v))
            throw new ConflictException(
              'Save this draft version before submission.',
            );
        }
        const result = await this.issue(
          m,
          a,
          b,
          'MANUAL',
          v,
          'manual:' + v.reference.trim().toUpperCase(),
          draft ? { draftId: draft.id } : {},
        );
        if (draft)
          await m.query(
            'UPDATE finance_gl_drafts SET candidate_id=$1 WHERE id=$2 AND candidate_id IS NULL',
            [result.id, draft.id],
          );
        return result;
      },
    );
  }

  async issue(
    m: EntityManager,
    a: FoundationActor,
    b: ActivePostingBook,
    kind: string,
    v: VoucherInput,
    event: string,
    origin: Record<string, unknown> = {},
  ) {
    if (
      !v ||
      !candidateText(v.reference, 120) ||
      !candidateText(v.description, 1000) ||
      !isFinanceDate(v.date) ||
      !candidateText(v.currency, 3)
    )
      invalid(
        'Enter the voucher reference, posting date, currency and description.',
      );
    const deployment = await glDeployment(m, b);
    if (
      deployment?.action !== 'ENABLE' ||
      deployment.release_id !== b.release_id
    )
      throw new ConflictException(
        'Enable this approved book for FIN-02 posting.',
      );
    event = b.book_id + '/' + event;
    const requestHash = hash({ kind, v, event, origin });
    const [old] = await m.query(
      "SELECT candidate_id id,snapshot,c.subject_hash hash FROM finance_operating_postings p JOIN finance_journal_candidates c ON c.id=p.candidate_id WHERE p.book_id=$1 AND ((p.source_type='GL_VOUCHER' AND p.source_event_id=$2) OR (p.source_type IN ('GL_VOUCHER','GL_REVERSAL') AND upper(btrim(p.snapshot->>'reference'))=upper($3)))",
      [b.book_id, event, v.reference],
    );
    if (old) {
      if (old.snapshot.requestHash !== requestHash)
        throw new ConflictException(
          'This reference or occurrence already belongs to a different journal request.',
        );
      return { id: old.id, hash: old.hash, reused: true };
    }
    let supersedesCandidateId: string | undefined;
    if (v.replacementOf) {
      if (kind !== 'MANUAL' || !FINANCE_UUID.test(v.replacementOf))
        invalid('Select a reversed manual voucher for replacement.');
      const [rev] = await m.query(
        "SELECT j.id FROM finance_foundation_journals j JOIN finance_foundation_journals r ON r.reversal_of=j.id AND r.mode='LIVE' JOIN finance_operating_postings p ON p.candidate_id=j.candidate_id WHERE j.id=$1 AND j.book_id=$2 AND p.snapshot->>'component'='MANUAL' AND NOT (p.snapshot ?| array['apDocumentId','arDocumentId'])",
        [v.replacementOf, b.book_id],
      );
      if (!rev)
        throw new ConflictException(
          'Post the linked reversal before submitting a replacement.',
        );
      const [prior] = await m.query(
        `SELECT p.candidate_id,r.state FROM finance_operating_postings p JOIN finance_journal_candidates c ON c.id=p.candidate_id
        JOIN LATERAL(SELECT state FROM finance_approval_requests WHERE candidate_id=c.id ORDER BY expires_at DESC,id DESC LIMIT 1) r ON true
        WHERE p.book_id=$1 AND p.snapshot->>'replacementOf'=$2 ORDER BY c.created_at DESC,c.id DESC LIMIT 1`,
        [b.book_id, v.replacementOf],
      );
      if (prior && prior.state !== 'REJECTED_INACTIVE')
        throw new ConflictException(
          'This original already has a pending or posted replacement.',
        );
      supersedesCandidateId = prior?.candidate_id;
    }
    if (!Array.isArray(v.lines)) invalid('Enter the voucher lines.');
    const chart = await bookChart(m, b);
    if (
      v.evidence ||
      v.adjustmentPeriodId ||
      kind !== 'MANUAL' ||
      v.replacementOf ||
      v.lines?.some(
        (l) =>
          chart.roles.find((r) => r.code === l?.role)?.accountType ===
          'EXPENSE',
      )
    )
      await ownedEvidence(m, b, v.evidence);
    const prepared = await voucherLines(m, b, kind, v, chart);
    const id = randomUUID();
    return this.posting.submit(m, a, b, {
      type: 'GL_VOUCHER',
      id,
      event,
      description: v.description,
      snapshot: {
        ...origin,
        ...(v.adjustmentPeriodId
          ? { adjustmentPeriodId: v.adjustmentPeriodId }
          : {}),
        ...(supersedesCandidateId ? { supersedesCandidateId } : {}),
        requestHash,
        sourceId: id,
        companyId: b.company_id,
        eventType: kind,
        component: kind,
        reference: v.reference,
        description: v.description,
        transactionDate: v.date,
        currency: v.currency,
        amount: prepared.amount,
        evidence: v.evidence ?? null,
        replacementOf: v.replacementOf ?? null,
      },
      journal: {
        economicOrigin: 'FIN02_GL',
        economicSourceId: id,
        economicComponent: kind,
        sourceRevision: '1',
        correctionOf: null,
        lines: prepared.lines,
      },
    });
  }
  reverse(
    a: FoundationActor,
    s: FinanceBookSelection,
    id: string,
    v: {
      reference: string;
      date: string;
      description: string;
      evidence: Evidence;
      adjustmentPeriodId?: string;
    },
    ap?: {
      manager: EntityManager;
      originalApId?: string;
      originalArId?: string;
      arDocumentId?: string;
    },
  ) {
    return this.ledger.withWorkflowAuthority(
      a,
      s,
      'PREPARE',
      v.description,
      async ({ manager: m }) => {
        const b = await workflowBook(m, a, s);
        await ownedEvidence(m, b, v.evidence);
        const [row] = await m.query(
          "SELECT p.source_id FROM finance_foundation_journals j JOIN finance_operating_postings p ON p.candidate_id=j.candidate_id WHERE j.book_id=$1 AND j.id=$2 AND j.kind='ORIGINAL' AND j.mode='LIVE' AND p.source_type='GL_VOUCHER'",
          [b.book_id, id],
        );
        if (!row)
          throw new ConflictException(
            'Select a posted original voucher in this book.',
          );
        const orig = await originalPosting(m, b, 'GL_VOUCHER', row.source_id);
        if (
          orig.snapshot.arDocumentId &&
          orig.snapshot.arDocumentId !== ap?.originalArId
        )
          throw new ConflictException(
            'Reverse the originating customer document in Accounts Receivable.',
          );
        if (
          orig.snapshot.apDocumentId &&
          orig.snapshot.apDocumentId !== ap?.originalApId
        )
          throw new ConflictException(
            'Prepare the reversal in Accounts Payable so the supplier balance and journal change together.',
          );
        if (
          !isFinanceDate(v.date) ||
          v.date < orig.original_date ||
          !candidateText(v.reference, 120)
        )
          invalid(
            'Enter a distinct correction reference and an open posting date on or after the original.',
          );
        const fingerprint = hash({ id, v });
        const attempts = await m.query(
          `SELECT p.candidate_id,p.snapshot,r.state,c.subject_hash hash FROM finance_operating_postings p JOIN finance_journal_candidates c ON c.id=p.candidate_id
          JOIN LATERAL(SELECT state FROM finance_approval_requests WHERE candidate_id=c.id ORDER BY expires_at DESC,id DESC LIMIT 1) r ON true
          WHERE p.book_id=$1 AND p.snapshot->>'originalJournalId'=$2 AND p.source_type='GL_REVERSAL' ORDER BY c.created_at DESC,c.id DESC`,
          [b.book_id, id],
        );
        const replay = attempts.find(
          (x) => x.snapshot.requestHash === fingerprint,
        );
        if (replay)
          return { id: replay.candidate_id, hash: replay.hash, reused: true };
        const previous = attempts[0];
        if (previous && previous.state !== 'REJECTED_INACTIVE')
          throw new ConflictException(
            'This journal already has a pending or posted reversal.',
          );
        const [duplicate] = await m.query(
          "SELECT 1 FROM finance_operating_postings WHERE book_id=$1 AND source_type IN ('GL_VOUCHER','GL_REVERSAL') AND upper(btrim(snapshot->>'reference'))=upper($2)",
          [b.book_id, v.reference],
        );
        if (duplicate)
          throw new ConflictException('Use a unique reversal reference.');
        if (orig.snapshot.occurrence === 'INITIAL') {
          const [child] = await m.query(
            `SELECT 1 FROM finance_operating_postings p LEFT JOIN finance_foundation_journals j ON j.candidate_id=p.candidate_id AND j.mode='LIVE'
          WHERE p.book_id=$1 AND p.source_type='GL_VOUCHER' AND p.snapshot->>'programCode'=$2 AND p.snapshot->>'occurrence'<>'INITIAL'
          AND NOT EXISTS(SELECT 1 FROM finance_approval_requests ar WHERE ar.candidate_id=p.candidate_id AND ar.state='REJECTED_INACTIVE')
          AND NOT EXISTS(SELECT 1 FROM finance_foundation_journals r WHERE r.reversal_of=j.id AND r.mode='LIVE') LIMIT 1`,
            [b.book_id, orig.snapshot.programCode],
          );
          if (child)
            throw new ConflictException(
              'Resolve or reverse the instalments and settlements before reversing the initial balance.',
            );
        }
        return this.posting.submit(m, a, b, {
          type: 'GL_REVERSAL',
          id: previous ? randomUUID() : row.source_id,
          supersedes: previous?.candidate_id,
          event:
            'reverse:' + id + (previous ? '/' + previous.candidate_id : ''),
          description: v.description,
          snapshot: {
            ...orig.snapshot,
            ...(ap?.arDocumentId ? { arDocumentId: ap.arDocumentId } : {}),
            adjustmentPeriodId: v.adjustmentPeriodId ?? null,
            adjustmentPeriodCode: null,
            ...(previous
              ? { supersedesCandidateId: previous.candidate_id }
              : {}),
            requestHash: fingerprint,
            eventType: 'REVERSAL',
            reference: v.reference,
            transactionDate: v.date,
            originalJournalId: id,
            evidence: v.evidence,
            description: v.description,
            replacementOf: null,
          },
          journal: inverseJournal(orig),
        });
      },
      ap?.manager,
    );
  }
}
