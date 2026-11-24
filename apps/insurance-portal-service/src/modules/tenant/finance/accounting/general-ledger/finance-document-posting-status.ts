import type { EntityManager } from 'typeorm';

export async function withPostingStatus<
  T extends { id: string; company_id: string },
>(manager: EntityManager, type: 'INVOICE' | 'RECEIPT', document: T) {
  const [schema] = await manager.query(
    "SELECT to_regclass('public.finance_operating_postings') IS NOT NULL AS deployed",
  );
  if (!schema?.deployed) return document;
  const [row] = await manager.query(
    `SELECT p.candidate_id,j.id AS journal_id,(SELECT r.state='REJECTED_INACTIVE' FROM finance_approval_requests r WHERE r.candidate_id=p.candidate_id ORDER BY r.expires_at DESC,r.id DESC LIMIT 1) AS rejected
    FROM finance_operating_postings p LEFT JOIN finance_foundation_journals j ON j.candidate_id=p.candidate_id AND j.mode='LIVE'
    WHERE p.company_id=$1 AND p.source_type=$2 AND p.source_id=$3
    UNION ALL SELECT null,id,false FROM finance_journal_entries WHERE company_id=$1 AND source_type=$2 AND source_id=$3`,
    [document.company_id, type, document.id],
  );
  return row
    ? Object.assign(document, {
        accounting_status: row.journal_id
          ? 'POSTED'
          : row.rejected
            ? 'REJECTED'
            : 'AWAITING_APPROVAL',
        journal_id: row.journal_id,
        journal_candidate_id: row.candidate_id,
      })
    : document;
}
