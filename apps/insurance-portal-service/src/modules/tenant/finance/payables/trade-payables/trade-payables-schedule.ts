import type { EntityManager } from 'typeorm';
import { date } from './trade-payables.types';

export async function paymentSchedule(
  m: EntityManager,
  book: string,
  payOn: string,
  includeDiscounts: boolean,
) {
  date(payOn);
  return m.query(
    `WITH capacity AS (
    SELECT i.id,i.reference,i.party,i.currency,i.due_date,i.data->'details' details,sum(v.amount) available
    FROM finance_ap_status i JOIN finance_ap_movements v ON v.item_id=i.id JOIN finance_ap_status d ON d.id=v.document_id
    WHERE i.book_id=$1 AND i.kind IN ('BILL','EXPENSE','RETIREMENT') AND i.posted_date<=$2 AND d.state IN ('PENDING','APPROVED')
      AND (d.posted_date<=$2 OR v.amount<0)
      AND NOT EXISTS(SELECT 1 FROM finance_ap_records rev WHERE rev.book_id=$1 AND rev.kind='REVERSAL' AND rev.data->'details'->>'originalId'=i.id::text AND rev.state IN ('PENDING','APPROVED'))
    GROUP BY i.id,i.reference,i.party,i.currency,i.due_date,i.data HAVING sum(v.amount)>0)
    SELECT id,reference,party,currency,due_date::text AS "dueDate",available::text,
      CASE WHEN (details->>'discountBps')::int>0 AND (details->>'discountUntil')::date>=$2 THEN details->>'discountUntil' END AS "discountUntil"
    FROM capacity WHERE due_date<=$2 OR ($3 AND (details->>'discountBps')::int>0 AND (details->>'discountUntil')::date>=$2)
    ORDER BY due_date,party,reference`,
    [book, payOn, includeDiscounts],
  );
}
