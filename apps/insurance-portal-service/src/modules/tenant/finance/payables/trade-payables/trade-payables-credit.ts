import type { EntityManager } from 'typeorm';
import { conflict, record, type ApRecord } from './trade-payables.types';

// Unposted credits and debit reversals reserve capacity. Only an actual posting
// can add capacity back. Check every affected day when the document is backdated.
export async function checkBillCredits(
  m: EntityManager,
  book: string,
  bill: string,
  date: string,
  reduction = '0',
) {
  const [result] = await m.query(
    `WITH notes AS (
      SELECT id,kind,amount,doc_date,posted_date FROM finance_ap_status
      WHERE book_id=$1 AND kind IN ('DEBIT','CREDIT') AND data->'details'->>'itemId'=$2
        AND state IN ('PENDING','APPROVED')
    ), events AS (
      SELECT posted_date AS effective_on,amount delta FROM notes WHERE kind='DEBIT' AND posted_date IS NOT NULL
      UNION ALL SELECT doc_date,-amount FROM notes WHERE kind='CREDIT'
      UNION ALL SELECT coalesce(v.posted_date,v.doc_date),CASE n.kind WHEN 'DEBIT' THEN -n.amount ELSE n.amount END
        FROM notes n JOIN finance_ap_status v ON v.book_id=$1 AND v.kind='REVERSAL'
          AND v.data->'details'->>'originalId'=n.id::text AND v.state IN ('PENDING','APPROVED')
        WHERE n.kind='DEBIT' OR v.posted_date IS NOT NULL
    ), days AS (
      SELECT greatest(effective_on,$3::date) AS effective_on,delta FROM events UNION ALL SELECT $3::date,0
    ), balances AS (SELECT sum(sum(delta)) OVER (ORDER BY effective_on) adjusted FROM days GROUP BY effective_on)
    SELECT coalesce((b.data->'details'->>'creditableAmount')::numeric,b.amount)
      + (SELECT min(adjusted) FROM balances) >= $4::numeric allowed
    FROM finance_ap_records b WHERE b.book_id=$1 AND b.id=$2::text::uuid AND b.kind='BILL'`,
    [book, bill, date, reduction],
  );
  if (!result?.allowed)
    conflict(
      'Supplier credits exceed the invoiced amount and available debit notes. Resolve the dependent credit or debit reversal first.',
    );
}

export async function checkReservedCredit(m: EntityManager, r: ApRecord) {
  let note = r;
  if (r.kind === 'REVERSAL') {
    note = await record(m, r.book_id, r.data.details.originalId);
    if (note.kind !== 'DEBIT') return;
  } else if (r.kind === 'SUPPLIER_REFUND' || r.kind === 'CREDIT_APPLICATION') {
    note = await record(m, r.book_id, r.data.details.creditId);
  } else if (r.kind !== 'CREDIT') return;
  if (note.data.details.itemId)
    await checkBillCredits(m, r.book_id, note.data.details.itemId, r.doc_date);
}
