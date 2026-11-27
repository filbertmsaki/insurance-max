import Decimal from 'decimal.js';
import {
  account,
  bad,
  date,
  field,
  positive,
  type Context,
  type Document,
  doc,
  conflict,
} from './cash-bank.types';

export async function plan(c: Context, r: Document) {
  if (r.kind === 'CANCEL_PLAN') {
    const p = await doc(c, r.input.fields.target, 'PLAN');
    const [old] = await c.m.query(
      "SELECT id FROM finance_cb_documents WHERE book_id=$1 AND state='POSTED' AND kind='CANCEL_PLAN' AND input->'fields'->>'target'=$2",
      [c.b.book_id, p.id],
    );
    if (old || r.day < p.day) conflict('Select a current cash plan.');
    return;
  }
  const f = r.input.fields,
    a = await account(c, f.account);
  if (!['INFLOW', 'OUTFLOW'].includes(f.direction))
    bad('Choose inflow or outflow.');
  positive(f.amount, c.b.context.currencyScales[a.currency]);
  field(f.description, 'forecast description');
  date(f.due);
  if (f.due < r.day)
    bad('Planned movement must fall on or after its planning date.');
}
export async function positions(c: Context, asOf: string) {
  return c.m.query(
    `WITH sources AS (
    SELECT d.input->'fields'->>'account' account,sum((d.input->'fields'->>'amount')::numeric) reserved
    FROM finance_cb_documents d WHERE d.book_id=$1 AND d.day<=$2 AND (
      (d.kind='EFT' AND d.state='POSTED' AND coalesce(d.input->'fields'->>'apVoucher','')='' AND NOT EXISTS(SELECT 1 FROM finance_cb_documents u WHERE u.book_id=d.book_id AND u.state='POSTED' AND u.kind IN ('EFT_CANCEL','EFT_SETTLE','EFT_LINK') AND u.input->'fields'->>'target'=d.id::text AND u.day<=$2)) OR
      (d.kind IN ('PAYMENT','DEPOSIT','TRANSFER','WITHDRAW','REPLENISH','WALLET_SETTLE','CHEQUE') AND d.state='APPROVED'))
    GROUP BY 1
    UNION ALL SELECT a.id::text,sum(v.amount) FROM finance_ap_status v JOIN finance_cb_accounts a ON a.book_id=v.book_id AND a.account_code=v.data->>'bankAccount'
      WHERE v.book_id=$1 AND v.kind IN ('PAYMENT','ADVANCE','IMPREST') AND v.status IN ('APPROVED','AWAITING_GL') AND v.doc_date<=$2 GROUP BY a.id),
    reservations AS (SELECT account,sum(reserved) reserved FROM sources GROUP BY account)
    SELECT a.id,a.name,a.code,a.kind,a.currency,a.account_code,a.active,a.branch,a.manager_id,a.purpose,a.opening,a.starts::text,
    a.opening+coalesce(e.delta,0) balance,
    CASE WHEN a.kind='TILL' THEN a.opening+coalesce(e.delta,0) ELSE a.opening+coalesce(e.delta,0)-coalesce(e.uncleared,0) END cleared,
    coalesce(p.reserved,0) committed,a.opening+coalesce(e.delta,0)-CASE WHEN a.kind='TILL' THEN 0 ELSE coalesce(e.uncleared_receipts,0) END-coalesce(p.reserved,0) available,
    coalesce(t.total,0) in_transit,a.minimum_alert IS NOT NULL AND a.opening+coalesce(e.delta,0)-CASE WHEN a.kind='TILL' THEN 0 ELSE coalesce(e.uncleared_receipts,0)+coalesce(p.reserved,0) END<=a.minimum_alert low_balance,s.ends::text last_statement
    FROM finance_cb_accounts a LEFT JOIN reservations p ON p.account=a.id::text
    LEFT JOIN LATERAL(SELECT sum(v.amount) FILTER(WHERE NOT v.cutover) delta,
      sum(v.amount) FILTER(WHERE ml.id IS NULL AND off.id IS NULL) uncleared,
      sum(greatest(v.amount,0)) FILTER(WHERE ml.id IS NULL AND off.id IS NULL) uncleared_receipts
      FROM finance_cb_entries v LEFT JOIN finance_cb_documents off ON off.id=v.offset_id AND off.day<=$2 LEFT JOIN finance_cb_matches mx ON mx.entry_id=v.id LEFT JOIN finance_cb_statement_lines ml ON ml.id=mx.line_id AND ml.day<=$2 WHERE v.account_id=a.id AND v.day<=$2)e ON true
    LEFT JOIN LATERAL(SELECT sum(t.amount) total FROM finance_cb_transfers t JOIN finance_cb_documents d ON d.id=t.id LEFT JOIN finance_cb_documents r ON r.id=t.received_id WHERE source=a.id AND d.day<=$2 AND (r.id IS NULL OR r.day>$2))t ON true
    LEFT JOIN LATERAL(SELECT ends,closing FROM finance_cb_statements WHERE account_id=a.id AND ends<=$2 AND signoff_id IS NOT NULL ORDER BY ends DESC LIMIT 1)s ON true
    WHERE a.book_id=$1 AND a.starts<=$2 ORDER BY a.currency,a.code`,
    [c.b.book_id, date(asOf)],
  );
}
export async function forecast(c: Context, from: string, to: string) {
  date(from);
  date(to);
  if (from > to || (Date.parse(to) - Date.parse(from)) / 86400000 > 731)
    bad('Choose a forecast range of up to two years.');
  const cutoff = new Date(Date.parse(from) - 86400000)
    .toISOString()
    .slice(0, 10);
  const rows = await c.m.query(
    `WITH ar AS (
    SELECT h.invoice_id,h.currency,sum(h.invoice_delta) n FROM finance_ar_activity($1,$5) h WHERE h.day<$3 GROUP BY h.invoice_id,h.currency),
    ap AS (SELECT i.id,i.reference,i.currency,i.due_date,sum(m.amount) n FROM finance_ap_movements m JOIN finance_ap_status d ON d.id=m.document_id JOIN finance_ap_records i ON i.id=m.item_id WHERE i.book_id=$2 AND d.posted_date<$3 AND i.kind IN ('BILL','EXPENSE','RETIREMENT') GROUP BY i.id),
    items AS (
    SELECT 'Receivable' source,i.invoice_no reference,ar.currency,greatest(coalesce(i.due_date,$3),$3) due,ar.n amount FROM ar JOIN invoices i ON i.id=ar.invoice_id WHERE ar.n>0
    UNION ALL SELECT 'Supplier or employee payable',reference,currency,greatest(coalesce(due_date,$3),$3),-n FROM ap WHERE n>0
    UNION ALL SELECT 'Scheduled advance or imprest',v.reference,v.currency,greatest(v.due_date,$3),-v.amount FROM finance_ap_status v WHERE v.book_id=$2 AND v.kind IN ('ADVANCE','IMPREST') AND v.state='APPROVED' AND v.doc_date<=$3 AND (v.posted_date IS NULL OR v.posted_date>=$3)
    UNION ALL SELECT 'Claim',disbursement_no,currency_code,$3::date,-amount FROM claim_disbursements WHERE company_id=$1 AND (requested_at AT TIME ZONE $5)::date<$3 AND (confirmed_at IS NULL OR (confirmed_at AT TIME ZONE $5)::date>=$3) AND (failed_at IS NULL OR (failed_at AT TIME ZONE $5)::date>=$3) AND status<>'CANCELLED'
    UNION ALL SELECT 'Treasury plan',d.reference,a.currency,greatest((d.input->'fields'->>'due')::date,$3),
      (d.input->'fields'->>'amount')::numeric*CASE WHEN d.input->'fields'->>'direction'='INFLOW' THEN 1 ELSE -1 END
      FROM finance_cb_documents d JOIN finance_cb_accounts a ON a.id::text=d.input->'fields'->>'account' WHERE d.book_id=$2 AND d.kind='PLAN' AND d.state='POSTED' AND d.day<=$3 AND NOT EXISTS(SELECT 1 FROM finance_cb_documents x WHERE x.kind='CANCEL_PLAN' AND x.state='POSTED' AND x.input->'fields'->>'target'=d.id::text AND x.day<=$3)
    UNION ALL SELECT 'EFT instruction',d.reference,a.currency,greatest(d.day,$3),-(d.input->'fields'->>'amount')::numeric FROM finance_cb_documents d JOIN finance_cb_accounts a ON a.id::text=d.input->'fields'->>'account' WHERE d.book_id=$2 AND d.kind='EFT' AND d.state='POSTED' AND coalesce(d.input->'fields'->>'apVoucher','')='' AND d.day<=$3 AND NOT EXISTS(SELECT 1 FROM finance_cb_documents x WHERE x.kind IN ('EFT_CANCEL','EFT_SETTLE','EFT_LINK') AND x.state='POSTED' AND x.input->'fields'->>'target'=d.id::text AND x.day<$3))
    SELECT source,reference,currency,due::text,amount::text FROM items WHERE due<=$4 ORDER BY due,source,reference`,
    [c.b.company_id, c.b.book_id, from, to, c.b.timezone],
  );
  const opening = await positions(c, cutoff);
  const dayOne = await c.m.query(
    'SELECT currency,sum(opening) amount FROM finance_cb_accounts WHERE book_id=$1 AND starts=$2 GROUP BY currency',
    [c.b.book_id, from],
  );
  const actual = await c.m.query(
    `SELECT a.currency,e.day::text,sum(greatest(e.amount,0)) inflow,sum(greatest(-e.amount,0)) outflow FROM finance_cb_entries e JOIN finance_cb_accounts a ON a.id=e.account_id LEFT JOIN finance_cb_documents d ON d.journal_id=e.journal_id LEFT JOIN finance_cb_documents orig ON d.kind='REVERSE' AND orig.id::text=d.input->'fields'->>'target' WHERE a.book_id=$1 AND e.day BETWEEN $2 AND $3 AND NOT e.cutover AND NOT EXISTS(SELECT 1 FROM finance_cb_documents off WHERE off.id=e.offset_id AND off.day<=$3) AND coalesce(orig.kind,d.kind,'') NOT IN ('TRANSFER','WITHDRAW','DEPOSIT','REPLENISH','WALLET_SETTLE','RECEIVE') GROUP BY a.currency,e.day ORDER BY e.day`,
    [c.b.book_id, from, to],
  );
  const currencies = Array.from(
    new Set<string>(
      [...opening, ...dayOne, ...rows, ...actual].map((x) => x.currency),
    ),
  ).sort();
  const periods: ({ month: string } & ReturnType<typeof projection>)[] = [];
  const totals = currencies.map((currency) => {
    const start = sum(
      opening
        .filter((x: AccountPosition) => x.currency === currency)
        .map((x: AccountPosition) =>
          new Decimal(x.balance).plus(x.in_transit).toFixed(),
        ),
    ).plus(
      sum(
        dayOne
          .filter((x: { currency: string }) => x.currency === currency)
          .map((x: { amount: string }) => x.amount),
      ),
    );
    const items: Expected[] = rows.filter(
      (x: Expected) => x.currency === currency,
    );
    const observed: Observed[] = actual.filter(
      (x: Observed) => x.currency === currency,
    );
    let balance = start;
    for (let month = from.slice(0, 7) + '-01'; month <= to; ) {
      const prefix = month.slice(0, 7);
      const bucket = projection(
        currency,
        balance,
        items.filter((x) => x.due.startsWith(prefix)),
        observed.filter((x) => x.day.startsWith(prefix)),
      );
      periods.push({ month: prefix, ...bucket });
      balance = new Decimal(bucket.closing);
      const next = new Date(month + 'T00:00:00Z');
      next.setUTCMonth(next.getUTCMonth() + 1);
      month = next.toISOString().slice(0, 10);
    }
    return projection(currency, start, items, observed);
  });
  return { from, to, totals, periods, items: rows, actual };
}
type Expected = { currency: string; amount: string; due: string };
type Observed = {
  currency: string;
  day: string;
  inflow: string;
  outflow: string;
};
function sum(values: Decimal.Value[]) {
  return values.reduce<Decimal>(
    (total, value) => total.plus(value),
    new Decimal(0),
  );
}
function projection(
  currency: string,
  opening: Decimal,
  items: Expected[],
  actual: Observed[],
) {
  const amounts = items.map((x) => new Decimal(x.amount));
  const inflow = sum(amounts.filter((n) => n.gt(0))),
    outflow = sum(amounts.filter((n) => n.lt(0))).abs(),
    net = inflow.minus(outflow);
  return {
    currency,
    opening: opening.toFixed(),
    inflow: inflow.toFixed(),
    outflow: outflow.toFixed(),
    net: net.toFixed(),
    closing: opening.plus(net).toFixed(),
    actualInflow: sum(actual.map((x) => x.inflow)).toFixed(),
    actualOutflow: sum(actual.map((x) => x.outflow)).toFixed(),
  };
}
interface AccountPosition {
  currency: string;
  balance: string;
  in_transit: string;
}
