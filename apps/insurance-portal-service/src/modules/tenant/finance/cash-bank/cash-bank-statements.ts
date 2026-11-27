import Decimal from 'decimal.js';
import { glCashBalance } from './cash-bank-setup';
import { bookChart } from '../accounting/general-ledger/finance-book-request';
import { financeConfigurationHash as hash } from '../foundation/finance-configuration/finance-configuration.types';
import {
  account,
  bad,
  conflict,
  date,
  field,
  money,
  uuid,
  type Context,
  type Document,
  type Account,
} from './cash-bank.types';

export function readCsv(text: string, delimiter = ','): string[][] {
  if (
    typeof text !== 'string' ||
    !text.trim() ||
    text.length > 1500000 ||
    ![',', ';', '\t'].includes(delimiter)
  )
    bad('Select a CSV statement up to 1.5 MB and a supported delimiter.');
  const rows: string[][] = [];
  let row: string[] = [],
    cell = '',
    quoted = false,
    ended = false;
  const finish = () => {
    row.push(cell.trim());
    if (row.some((x) => x)) rows.push(row);
    row = [];
    cell = '';
    ended = false;
  };
  const data = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < data.length; i++) {
    const ch = data[i];
    if (quoted) {
      if (ch === '"') {
        if (data[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          ended = true;
        }
      } else cell += ch;
      continue;
    }
    if (ch === delimiter) {
      row.push(cell.trim());
      cell = '';
      ended = false;
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && data[i + 1] === '\n') i++;
      finish();
    } else if (ch === '"' && !cell && !ended) quoted = true;
    else if (ch === '"' || (ended && ch.trim()))
      bad('Invalid quoting in the CSV statement.');
    else cell += ch;
  }
  if (quoted) bad('Incomplete quoted field in the CSV statement.');
  finish();
  if (rows.length > 10001)
    bad('Import up to 10,000 statement lines at a time.');
  return rows;
}
type Line = {
  day: string;
  reference: string;
  description: string;
  amount: string;
};
export function statementRows(
  f: Record<string, string>,
  scale: number,
  iso?: string,
): Line[] {
  const [header, ...rows] = readCsv(
    f.csv,
    f.delimiter === 'tab' ? '\t' : f.delimiter || ',',
  );
  if (
    !header ||
    new Set(header.map((x) => x.toLowerCase())).size !== header.length
  )
    bad('The statement needs distinct column headers.');
  const col = (name: string, optional = false) => {
    const i = header.findIndex((x) => x.toLowerCase() === name.toLowerCase());
    if (i < 0 && !optional) bad('Missing statement column ' + name + '.');
    return i;
  };
  const day = col(f.dateColumn || 'date'),
    ref = col(f.referenceColumn || 'reference', !f.referenceColumn),
    currencyCol = col(f.currencyColumn || 'currency', !f.currencyColumn),
    desc = col(f.descriptionColumn || 'description', !f.descriptionColumn),
    split = !!(f.debitColumn || f.creditColumn),
    amount = split ? -1 : col(f.amountColumn || 'amount'),
    debit = split ? col(f.debitColumn || 'debit') : -1,
    credit = split ? col(f.creditColumn || 'credit') : -1;
  const number = (s: string, signed = false) =>
    money(
      (s || '0').replace(/^(\-?\d{1,3}(,\d{3})+)(\.\d+)?$/, (v) =>
        v.replace(/,/g, ''),
      ),
      scale,
      signed,
    );
  return rows.map((row, i) => {
    if (row.length !== header.length)
      bad('Check the number of columns on CSV row ' + (i + 2) + '.');
    if (
      currencyCol >= 0 &&
      iso &&
      row[currencyCol].trim().toUpperCase() !== iso
    )
      bad('The currency on statement row ' + (i + 2) + ' must be ' + iso + '.');
    let on = row[day];
    if (f.dateFormat === 'DD/MM/YYYY') {
      const match = /^(\d\d)\/(\d\d)\/(\d{4})$/.exec(on);
      if (!match) return bad('Use DD/MM/YYYY dates in this file.');
      on = match[3] + '-' + match[2] + '-' + match[1];
    }
    let n: Decimal;
    if (split) {
      const dr = number(row[debit]),
        cr = number(row[credit]);
      if (dr.gt(0) && cr.gt(0))
        bad('Use one debit or credit per statement line.');
      n = cr.minus(dr);
    } else n = number(row[amount], true);
    if (n.eq(0)) bad('A statement row must contain a non-zero movement.');
    return {
      day: date(on),
      reference: field(
        row[ref] || row[desc] || 'Statement row ' + (i + 1),
        'bank reference',
        180,
      ),
      description: row[desc] || '',
      amount: n.toFixed(),
    };
  });
}
async function statement(c: Context, id: unknown) {
  const [s] = await c.m.query(
    'SELECT s.*,s.starts::text,s.ends::text FROM finance_cb_statements s JOIN finance_cb_accounts a ON a.id=s.account_id WHERE s.id=$1 AND a.book_id=$2 FOR UPDATE OF s',
    [uuid(id), c.b.book_id],
  );
  if (!s || s.signoff_id)
    conflict('Select an unsigned bank statement from this book.');
  return s;
}
export async function statementLine(
  c: Context,
  id: unknown,
  linkedEntry?: string,
) {
  const [s] = await c.m.query(
    `SELECT l.*,l.day::text,s.account_id,s.signoff_id,x.entry_id FROM finance_cb_statement_lines l JOIN finance_cb_statements s ON s.id=l.statement_id JOIN finance_cb_accounts a ON a.id=s.account_id LEFT JOIN finance_cb_matches x ON x.line_id=l.id WHERE l.id=$1 AND a.book_id=$2 FOR UPDATE OF l`,
    [uuid(id), c.b.book_id],
  );
  if (
    !s ||
    ((s.signoff_id || s.entry_id) &&
      (!linkedEntry || s.entry_id !== linkedEntry))
  )
    conflict('Select an unmatched line on an unsigned statement in this book.');
  return s;
}
async function importStatement(c: Context, r: Document, ac: Account) {
  const f = r.input.fields,
    m = c.m,
    scale = c.b.context.currencyScales[ac.currency],
    start = date(f.from),
    end = date(f.to);
  if (ac.kind === 'TILL' || start < ac.starts || end < start || r.day < end)
    bad('Use a bank or wallet and a valid statement period.');
  const op = money(f.opening, scale, true),
    cl = money(f.closing, scale, true);
  const [overlap] = await m.query(
    'SELECT id FROM finance_cb_statements WHERE account_id=$1 AND starts<=$3 AND ends>=$2',
    [ac.id, start, end],
  );
  if (overlap)
    conflict('This account already has a statement for part of this period.');
  let rows: Line[];
  if (f.batch) {
    const [batch] = await m.query(
      'SELECT * FROM finance_reconciliation_batches WHERE company_id=$1 AND id=$2',
      [c.b.company_id, uuid(f.batch)],
    );
    const [details] = await m.query(
      'SELECT account_number FROM finance_cb_accounts WHERE id=$1',
      [ac.id],
    );
    if (
      !batch ||
      batch.status !== 'POSTED' ||
      batch.currency_code !== ac.currency ||
      ![ac.code, details.account_number].includes(batch.account_reference) ||
      batch.opening_balance == null ||
      batch.closing_balance == null ||
      !op.eq(batch.opening_balance) ||
      !cl.eq(batch.closing_balance)
    )
      conflict(
        'Use a posted statement batch with the same account, currency and balances.',
      );
    rows = await m.query(
      "SELECT transaction_date::text day,coalesce(external_reference,payer_reference,line_number::text) reference,coalesce(description,'') description,amount::text FROM finance_reconciliation_items WHERE batch_id=$1 AND status<>'DUPLICATE' ORDER BY line_number",
      [batch.id],
    );
  } else rows = statementRows(f, scale, ac.currency);
  if (
    rows.some((x) => x.day < start || x.day > end) ||
    !rows.reduce((a, x) => a.plus(x.amount), op).eq(cl)
  )
    conflict(
      'Statement dates and opening plus signed movements must agree to the closing balance.',
    );
  await m.query(
    'INSERT INTO finance_cb_statements(id,account_id,starts,ends,opening,closing,digest,source_batch) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
    [
      r.id,
      ac.id,
      start,
      end,
      op.toFixed(),
      cl.toFixed(),
      hash({ start, end, rows }),
      f.batch || null,
    ],
  );
  await m.query(
    `INSERT INTO finance_cb_statement_lines(statement_id,ordinal,day,reference,description,amount) SELECT $1,n,x.day,x.reference,x.description,x.amount FROM jsonb_array_elements($2::jsonb) WITH ORDINALITY AS t(data,n) CROSS JOIN LATERAL jsonb_to_record(t.data) x(day date,reference text,description text,amount numeric)`,
    [r.id, JSON.stringify(rows)],
  );
  await m.query(
    `WITH suggestions AS (SELECT l.id,min(t.kind) kind,min(t.role) role FROM finance_cb_statement_lines l JOIN finance_cb_rules t ON t.account_id=$2 AND t.incoming=(l.amount>0) AND strpos(upper(l.description||' '||l.reference),t.pattern)>0 WHERE l.statement_id=$1 GROUP BY l.id HAVING count(*)=1)
    UPDATE finance_cb_statement_lines l SET suggested_kind=s.kind,suggested_role=s.role FROM suggestions s WHERE s.id=l.id`,
    [r.id, ac.id],
  );
}
export async function match(
  c: Context,
  lineId: string,
  entryId: string,
  decision: string,
) {
  const l = await statementLine(c, lineId);
  const [e] = await c.m.query(
    'SELECT e.id,e.amount,e.day::text,s.ends::text finish FROM finance_cb_entries e JOIN finance_cb_statements s ON s.id=$3 AND s.account_id=e.account_id WHERE e.id=$1 AND e.account_id=$2 AND e.offset_id IS NULL AND NOT EXISTS(SELECT 1 FROM finance_cb_matches m WHERE m.entry_id=e.id)',
    [uuid(entryId), l.account_id, l.statement_id],
  );
  if (!e || e.day > e.finish || !new Decimal(e.amount).eq(l.amount))
    conflict(
      'Match an unused entry on the same account with the same signed amount.',
    );
  await c.m.query('INSERT INTO finance_cb_matches VALUES($1,$2,$3)', [
    l.id,
    e.id,
    decision,
  ]);
  await c.m.query(
    "UPDATE finance_cb_cheques q SET state='CLEARED' FROM finance_cb_documents d JOIN finance_cb_entries e ON e.journal_id=d.journal_id WHERE q.id=d.id AND e.id=$1 AND q.state IN ('ISSUED','PRESENTED')",
    [e.id],
  );
}
export async function reconciliationSummary(c: Context, id: string) {
  const [s] = await c.m.query(
    'SELECT s.*,s.ends::text,a.currency,a.account_code FROM finance_cb_statements s JOIN finance_cb_accounts a ON a.id=s.account_id WHERE s.id=$1 AND a.book_id=$2',
    [uuid(id), c.b.book_id],
  );
  if (!s) bad('Choose a statement in this book.');
  if (s.signoff_id) return s.summary;
  const [t] = await c.m.query(
    `WITH e AS (SELECT e.*,(EXISTS(SELECT 1 FROM finance_cb_documents off WHERE off.id=e.offset_id AND off.day<=$3) OR EXISTS(SELECT 1 FROM finance_cb_matches x JOIN finance_cb_statement_lines l ON l.id=x.line_id JOIN finance_cb_statements st ON st.id=l.statement_id WHERE x.entry_id=e.id AND st.ends<=$3)) cleared FROM finance_cb_entries e WHERE e.account_id=$1 AND e.day<=$3)
   SELECT a.opening+coalesce(sum(e.amount) FILTER(WHERE NOT e.cutover),0) cashbook,
   coalesce(sum(e.amount) FILTER(WHERE NOT e.cleared AND e.amount>0),0) deposits,coalesce(sum(-e.amount) FILTER(WHERE NOT e.cleared AND e.amount<0),0) outstanding,
   count(e.id) FILTER(WHERE NOT e.cleared AND t.entry_id IS NULL)::int undocumented,
   (SELECT count(*) FROM finance_cb_statement_lines l WHERE statement_id=$2 AND NOT EXISTS(SELECT 1 FROM finance_cb_matches m WHERE m.line_id=l.id))::int unmatched
   FROM finance_cb_accounts a LEFT JOIN e ON true LEFT JOIN finance_cb_timing t ON t.entry_id=e.id WHERE a.id=$1 GROUP BY a.opening`,
    [s.account_id, id, s.ends],
  );
  const adjusted = new Decimal(s.closing).plus(t.deposits).minus(t.outstanding);
  const { opening: ledger } = await glCashBalance(
    c,
    s.account_code,
    s.currency,
    s.ends,
    true,
  );
  return {
    ...t,
    ledger,
    statement: s.closing,
    adjusted: adjusted.toFixed(),
    difference: new Decimal(ledger).minus(adjusted).toFixed(),
  };
}
export async function statementOperation(c: Context, r: Document) {
  const { m } = c,
    f = r.input.fields;
  if (r.kind === 'STATEMENT')
    return importStatement(c, r, await account(c, f.account));
  if (r.kind === 'END_RULE') {
    const deleted = await m.query(
      `WITH removed AS (DELETE FROM finance_cb_rules r USING finance_cb_accounts a WHERE r.account_id=a.id AND a.book_id=$1 AND r.decision_id=$2 RETURNING r.decision_id) SELECT * FROM removed`,
      [c.b.book_id, uuid(f.rule)],
    );
    if (!deleted.length) conflict('Choose a current bank rule from this book.');
    return;
  }
  if (r.kind === 'BANK_RULE') {
    const ac = await account(c, f.account),
      chart = await bookChart(m, c.b),
      incoming = f.direction === 'INFLOW',
      pattern = field(f.pattern, 'bank description text', 100).toUpperCase();
    if (
      ac.kind === 'TILL' ||
      !['FEE', 'INTEREST'].includes(f.classification) ||
      !['INFLOW', 'OUTFLOW'].includes(f.direction) ||
      (f.classification === 'FEE' && incoming) ||
      !chart.roles.some(
        (t) =>
          t.code === f.role &&
          t.accountType === (incoming ? 'INCOME' : 'EXPENSE'),
      )
    )
      bad(
        'Select a bank adjustment and a GL role appropriate for the direction.',
      );
    await m.query(
      'INSERT INTO finance_cb_rules VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(account_id,pattern,incoming) DO UPDATE SET kind=excluded.kind,role=excluded.role,decision_id=excluded.decision_id',
      [ac.id, pattern, incoming, f.classification, f.role, r.id],
    );
    return;
  }
  if (r.kind === 'MATCH') return match(c, f.line, f.entry, r.id);
  if (r.kind === 'TIMING') {
    const [e] = await m.query(
      "SELECT e.id FROM finance_cb_entries e JOIN finance_cb_accounts a ON a.id=e.account_id WHERE e.id=$1 AND a.book_id=$2 AND e.offset_id IS NULL AND a.kind<>'TILL' AND NOT EXISTS(SELECT 1 FROM finance_cb_matches WHERE entry_id=e.id)",
      [uuid(f.entry), c.b.book_id],
    );
    if (!e)
      conflict('Select an outstanding entry on a bank account or wallet.');
    await m.query(
      'INSERT INTO finance_cb_timing VALUES($1,$2) ON CONFLICT DO NOTHING',
      [e.id, r.id],
    );
    return;
  }
  if (r.kind === 'UNMATCH') {
    const [x] = await m.query(
      'SELECT l.id,s.id statement_id,m.entry_id FROM finance_cb_statement_lines l JOIN finance_cb_statements s ON s.id=l.statement_id JOIN finance_cb_matches m ON m.line_id=l.id WHERE l.id=$1',
      [uuid(f.line)],
    );
    if (!x) conflict('Choose a matched statement line.');
    await statement(c, x.statement_id);
    await m.query('DELETE FROM finance_cb_matches WHERE line_id=$1', [x.id]);
    await m.query(
      "UPDATE finance_cb_cheques q SET state='PRESENTED' FROM finance_cb_documents d JOIN finance_cb_entries e ON e.journal_id=d.journal_id WHERE q.id=d.id AND e.id=$1 AND q.state='CLEARED'",
      [x.entry_id],
    );
    return;
  }
  const s = await statement(c, f.statement);
  if (r.kind === 'AUTO_MATCH') {
    await m.query(
      `WITH pairs AS (SELECT l.id line,e.id entry,count(*) OVER(PARTITION BY l.id) n,count(*) OVER(PARTITION BY e.id) uses FROM finance_cb_statement_lines l JOIN finance_cb_entries e ON e.account_id=$2 AND e.offset_id IS NULL AND e.day<=$3 AND e.amount=l.amount AND upper(trim(e.reference))=upper(trim(l.reference)) WHERE l.statement_id=$1 AND NOT EXISTS(SELECT 1 FROM finance_cb_matches x WHERE x.line_id=l.id OR x.entry_id=e.id)),
      matched AS (INSERT INTO finance_cb_matches(line_id,entry_id,decision_id) SELECT line,entry,$4 FROM pairs WHERE n=1 AND uses=1 RETURNING entry_id)
      UPDATE finance_cb_cheques q SET state='CLEARED' FROM matched m JOIN finance_cb_entries e ON e.id=m.entry_id JOIN finance_cb_documents d ON d.journal_id=e.journal_id WHERE q.id=d.id AND q.state IN ('ISSUED','PRESENTED')`,
      [s.id, s.account_id, s.ends, r.id],
    );
    return;
  }
  const [chain] = await m.query(
    `SELECT a.starts::text activation,p.ends IS NULL first,p.signoff_id signed,p.closing prev,(p.ends+1)::text next FROM finance_cb_accounts a LEFT JOIN LATERAL(SELECT * FROM finance_cb_statements WHERE account_id=a.id AND ends<$2 ORDER BY ends DESC LIMIT 1)p ON true WHERE a.id=$1`,
    [s.account_id, s.starts],
  );
  if (
    chain.first
      ? s.starts !== chain.activation
      : !chain.signed ||
        s.starts !== chain.next ||
        !new Decimal(chain.prev).eq(s.opening)
  )
    conflict(
      'Sign off consecutive statements with continuous balances starting at cutover.',
    );
  const sum = await reconciliationSummary(c, s.id);
  if (
    sum.unmatched ||
    sum.undocumented ||
    !new Decimal(sum.difference).eq(0) ||
    !new Decimal(sum.ledger).eq(sum.cashbook)
  )
    conflict(
      'Resolve every statement line, evidence each timing item and reconcile the difference to zero.',
    );
  const [own] = await m.query(
    `SELECT 1 FROM finance_cb_documents d WHERE d.maker_person=$2 AND (d.id=$1 OR d.id IN
    (SELECT x.decision_id FROM finance_cb_matches x JOIN finance_cb_statement_lines l ON l.id=x.line_id WHERE l.statement_id=$1)) LIMIT 1`,
    [s.id, c.a.naturalPersonId],
  );
  if (own)
    conflict(
      'The person signing off must be independent of the statement importer and match preparers.',
    );
  await m.query(
    'UPDATE finance_cb_statements SET signoff_id=$2,summary=$3 WHERE id=$1',
    [s.id, r.id, sum],
  );
}
