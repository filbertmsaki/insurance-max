import { ConflictException } from '@nestjs/common';
import { validEvidence, invalid, type Evidence } from './finance-gl-program';
import type { FinanceChartProposal } from '../../foundation/chart-of-accounts/finance-chart.types';
import type { EntityManager } from 'typeorm';
import type { CurrencyContextInput } from './finance-ledger-foundation.types';
import type { JournalCandidateInput } from '../journal-entries/finance-journal-candidate.types';
import type { operatingDimensions } from '../../foundation/finance-setup/finance-operating-dimensions';

export type ActivePostingBook = Parameters<typeof operatingDimensions>[1] & {
  release_id: string;
  book_role: 'PRIMARY' | 'SECONDARY';
  timezone: string;
  controls: Parameters<typeof operatingDimensions>[1]['controls'] & {
    paymentMethods: { accountCode: string }[];
  };
  context_id: string;
  context_hash: string;
  context: CurrencyContextInput;
};
export async function activePostingBook(
  m: EntityManager,
  company: string,
  lock: 'UPDATE' | 'SHARE' = 'UPDATE',
  selectedBook?: string,
): Promise<ActivePostingBook | undefined> {
  const [book] = await m.query(
    `SELECT a.*,ctx.id context_id,ctx.subject_hash context_hash,ctx.payload AS context
      FROM ${selectedBook ? '(SELECT s.* FROM finance_operating_setups s WHERE s.company_id=$1 AND s.book_id=$2 AND s.withdrawn_at IS NULL AND finance_fin01_current(s.id))' : 'finance_fin01_primary($1)'} a JOIN finance_accounting_books b ON b.id=a.book_id
      JOIN LATERAL(SELECT action,release_id FROM finance_foundation_deployments WHERE book_id=b.id ORDER BY sequence DESC LIMIT 1)x ON x.action='ENABLE' AND x.release_id=a.release_id
      JOIN finance_foundation_documents rel ON rel.id=a.release_id JOIN finance_foundation_documents ctx ON ctx.id=rel.parent_id FOR ${lock} OF b`,
    selectedBook ? [company, selectedBook] : [company],
  );
  return book;
}
export async function glDeployment(m: EntityManager, book: ActivePostingBook) {
  const [schema] = await m.query(
    "SELECT to_regclass('public.finance_gl_deployments') IS NOT NULL installed",
  );
  if (!schema.installed) return undefined;
  const [d] = await m.query(
    'SELECT * FROM finance_gl_deployments WHERE book_id=$1 ORDER BY sequence DESC LIMIT 1',
    [book.book_id],
  );
  return d;
}
export interface PostingRequest {
  type: string;
  id: string;
  event: string;
  description: string;
  snapshot: {
    reference: string;
    currency: string;
    transactionDate: string;
    amount: string;
    [key: string]: unknown;
  };
  journal: Pick<
    JournalCandidateInput,
    | 'economicOrigin'
    | 'economicComponent'
    | 'economicSourceId'
    | 'sourceRevision'
    | 'correctionOf'
    | 'lines'
  >;
}
export async function originalPosting(
  m: EntityManager,
  book: ActivePostingBook,
  sourceType: string,
  id: string,
) {
  const [p] = await m.query(
    `SELECT p.*,c.subject_hash,c.payload,j.id journal_id,j.rate_id,j.rate_hash,j.accounting_date::text original_date
      FROM finance_operating_postings p JOIN finance_journal_candidates c ON c.id=p.candidate_id
      JOIN finance_foundation_journals j ON j.candidate_id=c.id AND j.mode='LIVE' AND j.kind='ORIGINAL'
      WHERE p.company_id=$1 AND p.book_id=$2 AND p.source_type=$3 AND p.source_id=$4`,
    [book.company_id, book.book_id, sourceType, id],
  );
  if (!p)
    throw new ConflictException(
      'Post the original request in this book before recording its correction.',
    );
  return p;
}
export function inverseJournal(original: {
  payload: JournalCandidateInput;
  candidate_id: string;
  subject_hash: string;
}): PostingRequest['journal'] {
  const p = original.payload;
  return {
    economicOrigin: p.economicOrigin,
    economicComponent: p.economicComponent,
    economicSourceId: p.economicSourceId,
    sourceRevision: p.sourceRevision,
    correctionOf: { id: original.candidate_id, hash: original.subject_hash },
    lines: p.lines.map((l) => ({ ...l, debit: l.credit, credit: l.debit })),
  };
}

export async function bookChart(
  m: EntityManager,
  b: ActivePostingBook,
): Promise<FinanceChartProposal> {
  const [chart] = await m.query(
    "SELECT payload FROM finance_configuration_releases WHERE book_id=$1 AND id=$2 AND release_hash=$3 AND kind='ACCOUNT_ROLES' FOR SHARE",
    [b.book_id, b.context.chartReleaseId, b.context.chartReleaseHash],
  );
  if (!chart) throw new ConflictException('Review the chart for this book.');
  return chart.payload.proposal;
}
export async function ownedEvidence(
  m: EntityManager,
  b: ActivePostingBook,
  e: Evidence | undefined,
) {
  if (!validEvidence(e))
    invalid('Select an owned supporting document version.');
  const [v] = await m.query(
    `SELECT v.id FROM document_versions v JOIN documents d ON d.id=v.document_id AND d.company_id=v.company_id
    WHERE v.id=$1 AND d.id=$2 AND v.sha256_hash=$3 AND v.company_id=$4 AND v.status='AVAILABLE' AND d.status='AVAILABLE'
    AND ((d.owner_type='COMPANY' AND d.owner_id=$4) OR (d.owner_type='FINANCE_SETUP' AND d.owner_id=$5)) FOR SHARE OF v,d`,
    [e.id, e.documentId, e.hash, b.company_id, b.book_id],
  );
  if (!v)
    throw new ConflictException(
      'The supporting document version is unavailable in this company or book.',
    );
}
