import type { EntityManager } from 'typeorm';

export async function withPostingStatus<
  T extends { id: string; company_id: string },
>(manager: EntityManager, type: 'INVOICE' | 'RECEIPT', document: T) {
  const [schema] = await manager.query(
    "SELECT to_regclass('public.finance_operating_postings') IS NOT NULL AS deployed,to_regclass('public.finance_gl_premium_memos') IS NOT NULL AS premiums",
  );
  if (!schema?.deployed) return document;
  if (
    type === 'INVOICE' &&
    'source_type' in document &&
    document.source_type === 'AR_OPENING'
  ) {
    const [opening] = await manager.query(
      'SELECT import_id,reference,invoice_date::text,cutoff::text,void_id FROM finance_ar_opening_items WHERE invoice_id=$1 AND company_id=$2',
      [document.id, document.company_id],
    );
    if (opening)
      return Object.assign(document, {
        accounting_status: opening.void_id
          ? 'VOIDED_OPENING'
          : 'CERTIFIED_OPENING',
        opening_invoice: opening,
      });
  }
  const [row] = await manager.query(
    `SELECT p.candidate_id,j.id AS journal_id,(SELECT r.state='REJECTED_INACTIVE' FROM finance_approval_requests r WHERE r.candidate_id=p.candidate_id ORDER BY r.expires_at DESC,r.id DESC LIMIT 1) AS rejected
    FROM finance_operating_postings p LEFT JOIN finance_foundation_journals j ON j.candidate_id=p.candidate_id AND j.mode='LIVE'
    WHERE p.company_id=$1 AND p.source_type=$2 AND p.source_id=$3
    UNION ALL SELECT null,id,false FROM finance_journal_entries WHERE company_id=$1 AND source_type=$2 AND source_id=$3`,
    [document.company_id, type, document.id],
  );
  if (!row && type === 'INVOICE' && schema.premiums) {
    const [memo] = await manager.query(
      `SELECT id,subject_hash FROM finance_gl_premium_memos WHERE company_id=$1 AND invoice_id=$2 ORDER BY created_at DESC,id DESC LIMIT 1`,
      [document.company_id, document.id],
    );
    if (memo) {
      const movements = await manager.query(
        `SELECT v.id,p.candidate_id,j.id journal_id,CASE WHEN j.id IS NOT NULL THEN 'POSTED' WHEN p.candidate_id IS NULL THEN 'MEASURED_NO_MOVEMENT'
        WHEN a.state='REJECTED_INACTIVE' THEN 'REJECTED' ELSE 'AWAITING_APPROVAL' END AS status FROM finance_gl_measurement_memos link
        JOIN finance_gl_insurance_measurements v ON v.id=link.measurement_id LEFT JOIN finance_operating_postings p ON p.book_id=v.book_id AND p.source_type='IFRS17_MEASUREMENT' AND p.source_id=v.id
        LEFT JOIN LATERAL(SELECT state FROM finance_approval_requests WHERE candidate_id=p.candidate_id ORDER BY expires_at DESC,id DESC LIMIT 1)a ON true
        LEFT JOIN finance_foundation_journals j ON j.candidate_id=p.candidate_id AND j.mode='LIVE' WHERE link.memo_id=$1 ORDER BY v.created_at DESC,v.id`,
        [memo.id],
      );
      const current =
        movements.find((x) => x.status === 'REJECTED') ??
        movements.find((x) => x.status === 'AWAITING_APPROVAL') ??
        movements.find((x) => x.status === 'POSTED') ??
        movements[0];
      return Object.assign(document, {
        accounting_status: current?.status ?? 'MEMORANDUM_RECORDED',
        premium_memo_id: memo.id,
        premium_memo_hash: memo.subject_hash,
        accounting_movements: movements,
        journal_id: current?.journal_id ?? null,
        journal_candidate_id: current?.candidate_id ?? null,
      });
    }
  }
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
