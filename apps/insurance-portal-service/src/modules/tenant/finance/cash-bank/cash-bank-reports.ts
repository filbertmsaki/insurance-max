import Decimal from 'decimal.js';
import {
  account,
  bad,
  date,
  field,
  positive,
  uuid,
  type Context,
  type Document,
  doc,
  conflict,
} from './cash-bank.types';

export async function plan(c: Context, r: Document) {
  if (r.kind === 'LINK_PLAN' || r.kind === 'UNLINK_PLAN') {
    const f = r.input.fields,
      p = await doc(c, f.target, 'PLAN'),
      entry = uuid(f.entry);
    const [e] = await c.m.query(
      `SELECT e.amount,e.day::text,j.reversal_of,op.source_type,d.kind FROM finance_cb_entries e JOIN finance_foundation_journals j ON j.id=e.journal_id
      LEFT JOIN finance_operating_postings op ON op.candidate_id=j.candidate_id LEFT JOIN finance_cb_documents d ON d.journal_id=j.id
      WHERE e.id=$1 AND e.account_id=$2 AND e.day BETWEEN $3 AND $4`,
      [entry, p.input.fields.account, p.day, r.day],
    );
    if (
      !e ||
      e.reversal_of ||
      e.source_type === 'RECEIPT_REVERSAL' ||
      [
        'TRANSFER',
        'WITHDRAW',
        'DEPOSIT',
        'REPLENISH',
        'WALLET_SETTLE',
        'RECEIVE',
        'REVERSE',
        'VOID',
        'STOP',
        'DISHONOUR',
      ].includes(e.kind) ||
      new Decimal(e.amount).gt(0) !== (p.input.fields.direction === 'INFLOW')
    )
      conflict(
        'Choose an external cashbook movement in the plan account and direction.',
      );
    const [later] = await c.m.query(
      `SELECT 1 FROM finance_cb_documents WHERE book_id=$1 AND state='POSTED' AND ((kind IN ('LINK_PLAN','UNLINK_PLAN') AND lower(input->'fields'->>'entry')=$2 AND day>$3) OR (kind='CANCEL_PLAN' AND input->'fields'->>'target'=$4 AND day<=$3))`,
      [c.b.book_id, entry, r.day, p.id],
    );
    if (later)
      conflict('Select an active plan and use the latest allocation date.');
    const [used] = await c.m.query(
      'SELECT plan_id FROM finance_cb_plan_entries($1,$2) WHERE entry_id=$3',
      [c.b.book_id, r.day, entry],
    );
    if (r.kind === 'LINK_PLAN' ? !!used : used?.plan_id !== p.id)
      conflict(
        'Verify the current allocation. Remove an existing link before assigning the movement.',
      );
    return;
  }
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
      sum(v.amount-coalesce(mx.matched,0)) FILTER(WHERE off.id IS NULL) uncleared,
      sum(greatest(v.amount-coalesce(mx.matched,0),0)) FILTER(WHERE off.id IS NULL) uncleared_receipts
      FROM finance_cb_entries v LEFT JOIN finance_cb_documents off ON off.id=v.offset_id AND off.day<=$2
      LEFT JOIN LATERAL(SELECT sum(x.amount) matched FROM finance_cb_matches x JOIN finance_cb_statement_lines l ON l.id=x.line_id
        WHERE x.entry_id=v.id AND l.day<=$2) mx ON true WHERE v.account_id=a.id AND v.day<=$2)e ON true
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
  // Actual cash comes from the selected dates. Only the balances still outstanding
  // at the end of those dates belong in the expected flows.
  const rows = await c.m.query(
    `WITH ar AS (
    SELECT h.invoice_id,h.currency,min(h.day) first_day,sum(h.invoice_delta) n FROM finance_ar_activity($1,$5) h WHERE h.day<=$4 GROUP BY h.invoice_id,h.currency),
    ap AS (SELECT i.id,i.reference,i.currency,i.due_date,min(d.posted_date) first_day,sum(m.amount) n FROM finance_ap_movements m JOIN finance_ap_status d ON d.id=m.document_id JOIN finance_ap_records i ON i.id=m.item_id WHERE i.book_id=$2 AND d.posted_date<=$4 AND i.kind IN ('BILL','EXPENSE','RETIREMENT') GROUP BY i.id),
    realized AS (SELECT * FROM finance_cb_plan_entries($2,$4)),
    plans AS (SELECT d.id,d.reference,a.currency,(d.input->'fields'->>'due')::date due,
      CASE WHEN d.input->'fields'->>'direction'='INFLOW' THEN 1 ELSE -1 END side,(d.input->'fields'->>'amount')::numeric planned,
      EXISTS(SELECT 1 FROM finance_cb_documents x WHERE x.book_id=$2 AND x.kind='CANCEL_PLAN' AND x.state='POSTED' AND x.input->'fields'->>'target'=d.id::text AND x.day<=$4) cancelled
      FROM finance_cb_documents d JOIN finance_cb_accounts a ON a.id::text=lower(d.input->'fields'->>'account') WHERE d.book_id=$2 AND d.kind='PLAN' AND d.state='POSTED' AND d.day<=$4),
    remaining AS (SELECT p.*,p.planned-coalesce((SELECT sum(x.amount)*p.side FROM realized x WHERE x.plan_id=p.id),0) rest FROM plans p),
    items AS (
    SELECT 'Receivable' source,i.invoice_no reference,ar.currency,greatest(i.due_date,ar.first_day,$3) due,ar.n amount FROM ar JOIN invoices i ON i.id=ar.invoice_id WHERE ar.n>0
    UNION ALL SELECT 'Supplier or employee payable',reference,currency,greatest(due_date,first_day,$3),-n FROM ap WHERE n>0
    UNION ALL SELECT 'Scheduled advance or imprest',v.reference,v.currency,greatest(v.due_date,v.doc_date,$3),-v.amount FROM finance_ap_status v WHERE v.book_id=$2 AND v.kind IN ('ADVANCE','IMPREST') AND v.state='APPROVED' AND v.doc_date<=$4 AND (v.posted_date IS NULL OR v.posted_date>$4)
    UNION ALL SELECT 'Claim',disbursement_no,currency_code,greatest((requested_at AT TIME ZONE $5)::date,$3),-amount FROM claim_disbursements WHERE company_id=$1 AND (requested_at AT TIME ZONE $5)::date<=$4 AND (confirmed_at IS NULL OR (confirmed_at AT TIME ZONE $5)::date>$4) AND (failed_at IS NULL OR (failed_at AT TIME ZONE $5)::date>$4) AND status<>'CANCELLED'
    UNION ALL SELECT 'Treasury plan',reference,currency,greatest(due,$3),rest*side FROM remaining WHERE rest>0 AND NOT cancelled
    UNION ALL SELECT 'Realized treasury plan',p.reference,p.currency,x.day,x.amount FROM realized x JOIN plans p ON p.id=x.plan_id WHERE x.day BETWEEN $3 AND $4
    UNION ALL SELECT 'EFT instruction',d.reference,a.currency,greatest(d.day,$3),-(d.input->'fields'->>'amount')::numeric FROM finance_cb_documents d JOIN finance_cb_accounts a ON a.id::text=d.input->'fields'->>'account' WHERE d.book_id=$2 AND d.kind='EFT' AND d.state='POSTED' AND coalesce(d.input->'fields'->>'apVoucher','')='' AND d.day<=$4 AND NOT EXISTS(SELECT 1 FROM finance_cb_documents x WHERE x.kind IN ('EFT_CANCEL','EFT_SETTLE','EFT_LINK') AND x.state='POSTED' AND x.input->'fields'->>'target'=d.id::text AND x.day<=$4))
    SELECT source,reference,currency,due::text,amount::text FROM items WHERE due<=$4 ORDER BY due,source,reference`,
    [c.b.company_id, c.b.book_id, from, to, c.b.timezone],
  );
  const opening = await positions(c, cutoff);
  const dayOne = await c.m.query(
    'SELECT currency,sum(opening) amount FROM finance_cb_accounts WHERE book_id=$1 AND starts=$2 GROUP BY currency',
    [c.b.book_id, from],
  );
  const actual = await c.m.query(
    `SELECT a.currency,e.day::text,sum(greatest(e.amount,0)) inflow,sum(greatest(-e.amount,0)) outflow FROM finance_cb_entries e JOIN finance_cb_accounts a ON a.id=e.account_id LEFT JOIN finance_cb_documents d ON d.journal_id=e.journal_id LEFT JOIN finance_cb_documents orig ON d.kind='REVERSE' AND orig.id::text=d.input->'fields'->>'target' WHERE a.book_id=$1 AND e.day BETWEEN $2 AND $3 AND NOT e.cutover AND coalesce(orig.kind,d.kind,'') NOT IN ('TRANSFER','WITHDRAW','DEPOSIT','REPLENISH','WALLET_SETTLE','RECEIVE') GROUP BY a.currency,e.day ORDER BY e.day`,
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
type Expected = {
  source: string;
  currency: string;
  amount: string;
  due: string;
};
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
  // Realized plan details explain the link to a cashbook movement. The cashbook counts it once.
  const expected = items
    .filter((x) => x.source !== 'Realized treasury plan')
    .map((x) => new Decimal(x.amount));
  const expectedInflow = sum(expected.filter((n) => n.gt(0))),
    expectedOutflow = sum(expected.filter((n) => n.lt(0))).abs(),
    actualInflow = sum(actual.map((x) => x.inflow)),
    actualOutflow = sum(actual.map((x) => x.outflow)),
    inflow = expectedInflow.plus(actualInflow),
    outflow = expectedOutflow.plus(actualOutflow),
    net = inflow.minus(outflow);
  return {
    currency,
    opening: opening.toFixed(),
    inflow: inflow.toFixed(),
    outflow: outflow.toFixed(),
    expectedInflow: expectedInflow.toFixed(),
    expectedOutflow: expectedOutflow.toFixed(),
    net: net.toFixed(),
    closing: opening.plus(net).toFixed(),
    actualInflow: actualInflow.toFixed(),
    actualOutflow: actualOutflow.toFixed(),
  };
}
interface AccountPosition {
  currency: string;
  balance: string;
  in_transit: string;
}
