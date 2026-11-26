import type { EntityManager } from 'typeorm';
import { DecimalUtil } from '../../../../shared/finance/decimal.util';
import {
  bookChart,
  type ActivePostingBook,
} from '../../accounting/general-ledger/finance-book-request';
import { certifiedOpening } from '../../accounting/general-ledger/finance-gl-balances';
import { financeConfigurationHash as hash } from '../../foundation/finance-configuration/finance-configuration.types';
import { day, invalid, uuid, type ArInput } from './customer-accounts.types';

export async function accountReport(
  m: EntityManager,
  b: ActivePostingBook,
  from: string,
  to: string,
  currency: string,
  customer?: string,
) {
  if (day(from) > day(to) || b.context.currencyScales[currency] === undefined)
    invalid('Choose a valid date range and book currency.');
  if (customer) uuid(customer, 'customer');
  const args = [b.company_id, b.timezone, currency, customer || null, to, from];
  const base = `WITH activity AS (SELECT * FROM finance_ar_activity($1,$2) WHERE currency=$3 AND ($4::uuid IS NULL OR customer_id=$4) AND day<=$5) `;
  const movements = await m.query(
    base +
      `, running_lines AS (SELECT a.*,c.customer_no,coalesce(c.display_name,c.company_name,c.customer_no) customer,
    sum(net) OVER(PARTITION BY a.customer_id ORDER BY day,CASE WHEN kind IN ('OPENING_INVOICE','OPENING_VOID') THEN 0 ELSE 1 END,source,kind,invoice_id ROWS UNBOUNDED PRECEDING)::text running
    FROM activity a JOIN customers c ON c.id=a.customer_id) SELECT r.*,r.day::text FROM running_lines r WHERE r.day>=$6 AND NOT (r.day=$6 AND r.kind IN ('OPENING_INVOICE','OPENING_VOID')) ORDER BY r.customer_id,r.day,CASE WHEN r.kind IN ('OPENING_INVOICE','OPENING_VOID') THEN 0 ELSE 1 END,r.source,r.kind,r.invoice_id`,
    args,
  );
  const totals = await m.query(
    base +
      `SELECT customer_id,currency,coalesce(sum(net) FILTER(WHERE day<$6 OR (day=$6 AND kind IN ('OPENING_INVOICE','OPENING_VOID'))),0)::text opening,
    coalesce(sum(net) FILTER(WHERE day>=$6 AND NOT(day=$6 AND kind IN ('OPENING_INVOICE','OPENING_VOID'))),0)::text movement,sum(net)::text closing FROM activity GROUP BY customer_id,currency ORDER BY customer_id`,
    args,
  );
  const aging = await m.query(
    base +
      `, items AS (SELECT a.customer_id,i.id,i.due_date, sum(a.invoice_delta) balance
    FROM activity a JOIN invoices i ON i.id=a.invoice_id GROUP BY a.customer_id,i.id,i.due_date)
    SELECT c.id customer_id,c.customer_no,coalesce(c.display_name,c.company_name,c.customer_no) customer,
    coalesce(sum(balance) FILTER(WHERE due_date>=$5 AND balance>0),0)::text current,
    coalesce(sum(balance) FILTER(WHERE $5::date-due_date BETWEEN 1 AND 30 AND balance>0),0)::text days_1_30,
    coalesce(sum(balance) FILTER(WHERE $5::date-due_date BETWEEN 31 AND 60 AND balance>0),0)::text days_31_60,
    coalesce(sum(balance) FILTER(WHERE $5::date-due_date BETWEEN 61 AND 90 AND balance>0),0)::text days_61_90,
    coalesce(sum(balance) FILTER(WHERE $5::date-due_date>90 AND balance>0),0)::text over_90,
    coalesce(sum(balance) FILTER(WHERE due_date IS NULL AND balance>0),0)::text undated,
    coalesce(sum(-balance) FILTER(WHERE balance<0),0)::text available_credit,
    sum(greatest(balance,0))::text outstanding FROM items JOIN customers c ON c.id=items.customer_id GROUP BY c.id ORDER BY c.customer_no`,
    args.slice(0, 5),
  );
  const balances = await m.query(
    `SELECT i.id,i.invoice_no,i.balance_amount::text native,coalesce(sum(a.invoice_delta),0)::text reconstructed
    FROM invoices i LEFT JOIN finance_ar_activity($1,$2) a ON a.invoice_id=i.id WHERE i.company_id=$1 AND i.currency=$3 AND i.deleted_at IS NULL AND i.status IN ('ISSUED','PARTIALLY_PAID','PAID','OVERPAID') AND ($4::uuid IS NULL OR i.customer_id=$4)
    GROUP BY i.id HAVING i.balance_amount<>greatest(coalesce(sum(a.invoice_delta),0),0)`,
    args.slice(0, 4),
  );
  const agingTotals = Object.fromEntries(
    [
      'current',
      'days_1_30',
      'days_31_60',
      'days_61_90',
      'over_90',
      'undated',
      'outstanding',
      'available_credit',
    ].map((k) => [
      k,
      aging
        .reduce(
          (
            total: ReturnType<typeof DecimalUtil.value>,
            row: Record<string, string>,
          ) => total.plus(row[k]),
          DecimalUtil.value(0),
        )
        .toFixed(),
    ]),
  );
  const lines = movements;
  return {
    from,
    to,
    currency,
    totals,
    aging,
    agingTotals,
    lines,
    balanceExceptions: balances,
    signature: hash({ from, to, currency, totals, lines }),
  };
}

export function matchStatement(
  input: ArInput,
  report: Awaited<ReturnType<typeof accountReport>>,
) {
  const dec = (s: unknown) => {
    if (typeof s !== 'string' || !/^-?\d{1,16}(\.\d{1,4})?$/.test(s))
      invalid('Enter signed statement amounts with up to four decimal places.');
    return DecimalUtil.value(s);
  };
  if (
    !Array.isArray(input.statementLines) ||
    input.statementLines.length > 10000
  )
    invalid('Supply the dated external statement movements.');
  const opening = dec(input.opening),
    closing = dec(input.amount),
    source = input.statementLines;
  const keys = source
    .map((l) => {
      if (
        day(l.date) < report.from ||
        l.date > report.to ||
        !l.reference?.trim()
      )
        invalid(
          'Each statement entry needs a reference and date inside the statement period.',
        );
      return [l.date, l.reference.trim(), dec(l.amount).toFixed()].join('|');
    })
    .sort();
  const internal = report.lines
    .filter((x) => !dec(x.net).eq(0))
    .map((x) => [x.day, x.reference, dec(x.net).toFixed()].join('|'))
    .sort();
  return (
    opening.eq(report.totals[0]?.opening ?? 0) &&
    closing.eq(report.totals[0]?.closing ?? 0) &&
    source.reduce((v, l) => v.plus(dec(l.amount)), opening).eq(closing) &&
    hash(keys) === hash(internal) &&
    report.balanceExceptions.length === 0
  );
}

export async function controlReport(
  m: EntityManager,
  b: ActivePostingBook,
  currency: string,
  to: string,
) {
  const [settings] = await m.query(
    "SELECT data FROM finance_ar_documents WHERE book_id=$1 AND currency=$2 AND kind='POLICY' AND state='APPROVED' AND effective_date<=$3 ORDER BY effective_date DESC,sequence DESC LIMIT 1",
    [b.book_id, currency, to],
  );
  const account = (await bookChart(m, b)).roles.find(
    (r) => r.code === settings?.data.roles.ar,
  )?.accountCode;
  if (!account) return { status: 'POLICY_REQUIRED' };
  const opening = await certifiedOpening(m, b.book_id, to);
  const functional = currency === b.context.functionalCurrency;
  const certified =
    opening.payload.balances.find(
      (x: { accountCode: string }) => x.accountCode === account,
    )?.signedBalance ?? '0';
  const [positions] = await m.query(
    'SELECT payload FROM finance_gl_fx_opening_sets WHERE opening_id=$1 AND account_code=$2',
    [opening.id, account],
  );
  const unassigned =
    !positions &&
    !DecimalUtil.value(certified).eq(0) &&
    Object.keys(b.context.currencyScales).length > 1;
  const initial = positions
    ? positions.payload
        .filter((p: { currency: string }) => p.currency === currency)
        .reduce(
          (sum: ReturnType<typeof DecimalUtil.value>, p: { foreign: string }) =>
            sum.plus(p.foreign),
          DecimalUtil.value(0),
        )
        .toFixed()
    : functional
      ? certified
      : '0';
  const [result] = await m.query(
    `WITH ledger AS (SELECT coalesce(sum(l.transaction_debit-l.transaction_credit),0)+$7::numeric amt
    FROM finance_foundation_journals j JOIN finance_foundation_lines l ON l.journal_id=j.id AND l.account_code=$3
    WHERE j.book_id=$1 AND j.mode='LIVE' AND j.transaction_currency=$4 AND j.accounting_date BETWEEN $6 AND $5),
    activity AS (SELECT a.* FROM finance_ar_activity($2,$8) a WHERE a.day<=$5 AND a.currency=$4),
    balances AS (SELECT coalesce(sum(net),0) amt FROM activity),
    memoranda AS (SELECT coalesce(sum(a.net),0) - coalesce((SELECT sum(d.amount) FROM finance_ar_documents d JOIN finance_gl_premium_memos pm ON pm.book_id=d.book_id AND pm.invoice_id=d.invoice_id AND pm.event_type='ISSUED' WHERE d.book_id=$1 AND d.kind='ADVANCE_APPLICATION' AND d.state='POSTED' AND d.currency=$4 AND d.effective_date<=$5 AND NOT EXISTS (SELECT 1 FROM finance_ar_documents reversal WHERE reversal.related_id=d.id AND reversal.kind='REVERSAL' AND reversal.state='POSTED' AND reversal.effective_date<=$5)),0) amt FROM activity a WHERE EXISTS(SELECT 1 FROM finance_gl_premium_memos pm WHERE pm.book_id=$1 AND pm.event_type='ISSUED' AND pm.invoice_id=coalesce(a.invoice_id,(SELECT r.invoice_id FROM receipts r WHERE r.id=a.source)))),
    advances AS (SELECT coalesce(sum(amount),0) amt FROM finance_ar_advance_movements WHERE book_id=$1 AND state='POSTED' AND currency=$4 AND effective_date<=$5)
    SELECT ledger.amt::text ledger,balances.amt::text customer_net,memoranda.amt::text premium_memorandum,advances.amt::text advance_liability,
     (balances.amt-memoranda.amt+advances.amt)::text control_expected,(ledger.amt-balances.amt+memoranda.amt-advances.amt)::text difference
    FROM ledger,balances,memoranda,advances`,
    [
      b.book_id,
      b.company_id,
      account,
      currency,
      to,
      opening.payload.date,
      initial,
      b.timezone,
    ],
  );
  return {
    account,
    currency,
    openingDate: opening.payload.date,
    certificateId: opening.id,
    certifiedBalance: initial,
    ...result,
    status: unassigned
      ? 'OPENING_ALLOCATION_REQUIRED'
      : DecimalUtil.value(result.difference).eq(0)
        ? 'MATCHED'
        : 'DIFFERENCE',
  };
}
