import type { EntityManager } from 'typeorm';
import { DecimalUtil } from '../../../../shared/finance/decimal.util';
import { financeConfigurationHash } from '../../foundation/finance-configuration/finance-configuration.types';
import { certifiedOpening } from '../../accounting/general-ledger/finance-gl-balances';
import {
  basePlan,
  date,
  fail,
  list,
  text,
  type Context,
  type Fields,
} from './trade-payables.types';
import { moneyMinor } from '../../accounting/general-ledger/finance-gl-program';

export async function availableCredits(
  m: EntityManager,
  book: string,
  timezone: string,
): Promise<Record<string, string>> {
  const rows: { id: string; available: string }[] = await m.query(
    `SELECT i.id,(-sum(v.amount))::text available
    FROM finance_ap_status i JOIN finance_ap_movements v ON v.item_id=i.id JOIN finance_ap_status d ON d.id=v.document_id
    WHERE i.book_id=$1 AND i.kind='CREDIT' AND i.posted_date<=(now() AT TIME ZONE $2)::date
      AND d.state IN ('APPROVED','PENDING') AND (d.posted_date<=(now() AT TIME ZONE $2)::date OR v.amount>0)
      AND NOT EXISTS(SELECT 1 FROM finance_ap_records rev WHERE rev.book_id=i.book_id AND rev.kind='REVERSAL' AND rev.state IN ('PENDING','APPROVED') AND rev.data->'details'->>'originalId'=i.id::text)
    GROUP BY i.id HAVING sum(v.amount)<0`,
    [book, timezone],
  );
  return Object.fromEntries(rows.map((r) => [r.id, r.available]));
}

export async function report(
  m: EntityManager,
  book: string,
  party: string,
  currency: string,
  from: string,
  to: string,
) {
  date(from);
  date(to);
  if (from > to) fail('The statement end must follow its start.');
  const cutoff = [book, party, currency, to];
  const entries = await m.query(
    `SELECT d.id,d.kind,d.reference,d.journal_no,d.posted_date::text AS date,i.party,i.currency,
      CASE WHEN i.kind IN ('ADVANCE','IMPREST') THEN 'ADVANCE' ELSE 'PAYABLE' END AS ledger,sum(v.amount)::text AS amount
    FROM finance_ap_movements v JOIN finance_ap_status d ON d.id=v.document_id JOIN finance_ap_records i ON i.id=v.item_id
    WHERE v.book_id=$1 AND ($2='' OR i.party=$2) AND i.currency=$3 AND d.posted_date<=$4
    GROUP BY d.id,d.sequence,d.kind,d.reference,d.journal_no,d.posted_date,i.party,i.currency,ledger HAVING sum(v.amount)<>0 ORDER BY d.posted_date,d.sequence,ledger`,
    cutoff,
  );
  const aging = await m.query(
    `WITH balances AS (
    SELECT i.id,i.party,i.kind,i.reference,i.due_date, sum(v.amount) AS balance FROM finance_ap_movements v
    JOIN finance_ap_status d ON d.id=v.document_id JOIN finance_ap_records i ON i.id=v.item_id
    WHERE v.book_id=$1 AND ($2='' OR i.party=$2) AND i.currency=$3 AND d.posted_date<=$4
    GROUP BY i.id HAVING sum(v.amount)<>0)
    SELECT id,party,kind,reference,due_date::text,balance::text,CASE WHEN kind IN ('ADVANCE','IMPREST') THEN 'ADVANCE'
      WHEN kind='CREDIT' THEN 'CREDIT' WHEN due_date>=$4::date THEN 'CURRENT' WHEN $4::date-due_date<=30 THEN '1-30'
      WHEN $4::date-due_date<=60 THEN '31-60' WHEN $4::date-due_date<=90 THEN '61-90' ELSE '90+' END bucket
    FROM balances ORDER BY party,due_date,reference`,
    cutoff,
  );
  const totals = (ledger: string, before?: string) =>
    entries
      .filter((e) => e.ledger === ledger && (!before || e.date < before))
      .reduce((sum, e) => sum.plus(e.amount), DecimalUtil.value(0))
      .toFixed();
  const running = new Map<string, ReturnType<typeof DecimalUtil.value>>();
  const period: Fields[] = [];
  for (const e of entries) {
    const key = e.party + '/' + e.ledger,
      balance = (running.get(key) ?? DecimalUtil.value(0)).plus(e.amount);
    running.set(key, balance);
    if (e.date >= from)
      period.push({ ...e, runningBalance: balance.toFixed() });
  }
  const grouped = new Map<string, Record<string, string>>();
  for (const item of aging.filter((x) => x.bucket !== 'ADVANCE')) {
    const group = grouped.get(item.party) ?? {
      party: item.party,
      CURRENT: '0',
      '1-30': '0',
      '31-60': '0',
      '61-90': '0',
      '90+': '0',
      CREDIT: '0',
      total: '0',
    };
    group[item.bucket] = DecimalUtil.value(group[item.bucket])
      .plus(item.balance)
      .toFixed();
    group.total = DecimalUtil.value(group.total).plus(item.balance).toFixed();
    grouped.set(item.party, group);
  }
  return {
    from,
    to,
    currency,
    opening: totals('PAYABLE', from),
    closing: totals('PAYABLE'),
    advanceOpening: totals('ADVANCE', from),
    advanceClosing: totals('ADVANCE'),
    entries: period,
    aging,
    agingTotals: [...grouped.values()],
    signature: financeConfigurationHash(entries),
  };
}
export async function tieOut(
  m: EntityManager,
  book: string,
  to: string,
  selectedAccount: string | null = null,
) {
  const opening = await certifiedOpening(m, book, to);
  return m.query(
    `WITH controls AS (
    SELECT DISTINCT data->'details'->>'controlAccount' account FROM finance_ap_records WHERE book_id=$1 AND data->'details' ? 'controlAccount'
    UNION SELECT DISTINCT jsonb_array_elements_text(data->'details'->'controlAccounts') FROM finance_ap_records WHERE book_id=$1 AND kind='SETTINGS' AND state='APPROVED'
    UNION SELECT $5::text WHERE $5::text IS NOT NULL),
    ledger AS (SELECT l.account_code, sum(l.functional_credit-l.functional_debit) balance
      FROM finance_foundation_lines l JOIN finance_foundation_journals j ON j.id=l.journal_id
      WHERE j.book_id=$1 AND j.mode='LIVE' AND j.accounting_date BETWEEN $3 AND $2 GROUP BY l.account_code),
    movements AS (SELECT j.id,j.transaction_currency,j.functional_currency,i.data->'details'->>'controlAccount' account,sum(v.amount) amount
      FROM finance_ap_movements v JOIN finance_ap_records d ON d.id=v.document_id JOIN finance_ap_records i ON i.id=v.item_id
      JOIN finance_foundation_journals j ON j.candidate_id=d.candidate_id AND j.mode='LIVE'
      WHERE v.book_id=$1 AND j.accounting_date<=$2 AND i.kind IN ('BILL','EXPENSE','RETIREMENT','CREDIT') GROUP BY j.id,i.data->'details'->>'controlAccount'),
    functional AS (SELECT v.account,sum(CASE WHEN v.transaction_currency=v.functional_currency THEN v.amount
      ELSE coalesce(v.amount*f.functional/nullif(f.foreign_amount,0),0) END) amount,
      bool_or(v.transaction_currency<>v.functional_currency AND coalesce(f.foreign_amount,0)=0 AND v.amount<>0) unresolved
      FROM movements v LEFT JOIN LATERAL(SELECT sum(l.functional_credit-l.functional_debit) functional,
        sum(l.transaction_credit-l.transaction_debit) foreign_amount FROM finance_foundation_lines l WHERE l.journal_id=v.id AND l.account_code=v.account) f ON true GROUP BY v.account),
    imported AS (SELECT i.data->'details'->>'controlAccount' account,sum(o.functional_amount) amount FROM finance_ap_opening_items o
      JOIN finance_ap_status i ON i.id=o.item_id WHERE o.book_id=$1 AND i.posted_date<=$2 GROUP BY i.data->'details'->>'controlAccount'),
    balances AS (SELECT c.account,coalesce((SELECT -(x->>'signedBalance')::numeric FROM jsonb_array_elements($4::jsonb) x WHERE x->>'accountCode'=c.account),0)
      +coalesce(l.balance,0) gl,coalesce(f.amount,0)+coalesce(o.amount,0) ap,coalesce(f.unresolved,false) unresolved FROM controls c LEFT JOIN ledger l ON l.account_code=c.account LEFT JOIN functional f ON f.account=c.account LEFT JOIN imported o ON o.account=c.account)
    SELECT account,gl::text AS "generalLedger",ap::text AS "supplierLedger",(gl-ap)::text AS difference,unresolved AS "unresolvedConversion" FROM balances ORDER BY account`,
    [
      book,
      date(to),
      opening.payload.date,
      JSON.stringify(opening.payload.balances),
      selectedAccount,
    ],
  );
}
export async function reconciliation(c: Context) {
  const d = c.input.details,
    from = date(d.from),
    to = c.input.date,
    state = await report(
      c.m,
      c.b.book_id,
      c.party,
      c.input.currency!,
      from,
      to,
    );
  const parse = (v: unknown) => {
    if (typeof v !== 'string' || !/^[-]?\d{1,26}(\.\d{1,12})?$/.test(v))
      fail('Enter signed statement amounts.');
    moneyMinor(v.replace(/^-/, ''), c.scale);
    return DecimalUtil.value(v);
  };
  const external =
    Array.isArray(d.lines) && !d.lines.length
      ? []
      : list(d.lines, 'supplier statement lines', 1000).map((l) => ({
          reference: text(l.reference, 'statement reference'),
          amount: parse(l.amount).toFixed(),
        }));
  const unmatched = state.entries.filter((e) => e.ledger === 'PAYABLE'),
    externalOnly: typeof external = [];
  for (const l of external) {
    const idx = unmatched.findIndex(
      (e) =>
        e.reference.toUpperCase() === l.reference.toUpperCase() &&
        DecimalUtil.value(e.amount).eq(l.amount),
    );
    if (idx < 0) externalOnly.push(l);
    else unmatched.splice(idx, 1);
  }
  const differences: Fields[] = externalOnly.map((l) => {
    const idx = unmatched.findIndex(
      (e) => e.reference.toUpperCase() === l.reference.toUpperCase(),
    );
    const ours = idx < 0 ? undefined : unmatched.splice(idx, 1)[0];
    return {
      reference: l.reference,
      external: l.amount,
      internal: ours?.amount ?? null,
      journal: ours?.journal_no ?? null,
    };
  });
  for (const e of unmatched)
    differences.push({
      reference: e.reference,
      external: null,
      internal: e.amount,
      journal: e.journal_no,
    });
  const opening = parse(d.opening),
    closing = parse(d.closing);
  if (!external.reduce((s, l) => s.plus(l.amount), opening).eq(closing))
    fail(
      'The external statement lines must reconcile its opening and closing balances.',
    );
  const matches =
    !differences.length &&
    opening.eq(state.opening) &&
    closing.eq(state.closing);
  return basePlan(c, {
    from,
    opening: opening.toFixed(),
    closing: closing.toFixed(),
    lines: external,
    differences,
    matches,
    signature: state.signature,
  });
}
