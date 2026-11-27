import {
  basePlan,
  cashKinds,
  conflict,
  move,
  record,
  text,
  type Context,
} from './trade-payables.types';
import { moneyMinor } from '../../accounting/general-ledger/finance-gl-program';
import { checkBillCredits } from './trade-payables-credit';

export async function prepareReversal(c: Context) {
  const original = await record(c.m, c.b.book_id, c.input.details.originalId);
  if (
    original.status !== 'POSTED' ||
    original.kind === 'REVERSAL' ||
    original.data.details.openingImportId ||
    original.party !== c.party ||
    original.currency !== c.input.currency
  )
    conflict('Select a posted original for this creditor and currency.');
  const [journal] = await c.m.query(
    'SELECT accounting_date::text date FROM finance_foundation_journals WHERE id=$1',
    [original.journal_id],
  );
  if (c.input.date < journal.date)
    conflict('The reversal must follow the original journal.');
  const [dependent] = await c.m.query(
    `SELECT 1 FROM finance_ap_movements v JOIN finance_ap_records child ON child.id=v.document_id
    WHERE v.book_id=$1 AND v.item_id=$2 AND child.id<>$2 AND child.kind<>'REVERSAL'
      AND child.state NOT IN ('REJECTED','CANCELLED') AND NOT EXISTS(
        SELECT 1 FROM finance_ap_status correction WHERE correction.book_id=$1 AND correction.kind='REVERSAL'
          AND correction.data->'details'->>'originalId'=child.id::text AND correction.posted_date<=$3) LIMIT 1`,
    [c.b.book_id, original.id, c.input.date],
  );
  if (dependent)
    conflict(
      'Withdraw or reverse dependent allocations before reversing their original open item.',
    );
  const [prior] = await c.m.query(
    "SELECT 1 FROM finance_ap_records WHERE book_id=$1 AND kind='REVERSAL' AND data->'details'->>'originalId'=$2 AND state NOT IN ('REJECTED','CANCELLED')",
    [c.b.book_id, original.id],
  );
  if (prior) conflict('A reversal already exists for this document.');
  if (original.kind === 'DEBIT')
    await checkBillCredits(
      c.m,
      c.b.book_id,
      original.data.details.itemId,
      c.input.date,
      original.amount,
    );
  const rows = await c.m.query(
    'SELECT v.item_id,v.amount::text,v.withholding::text,i.kind FROM finance_ap_movements v JOIN finance_ap_records i ON i.id=v.item_id WHERE v.book_id=$1 AND v.document_id=$2',
    [c.b.book_id, original.id],
  );
  const p = basePlan(c, {
    originalId: original.id,
    journalId: original.journal_id,
    description: text(c.input.details.description, 'reversal reason', 500),
  });
  for (const v of rows) {
    const signed = (n: string) =>
      n.startsWith('-')
        ? -moneyMinor(n.slice(1), c.scale)
        : moneyMinor(n, c.scale);
    const delta = -signed(v.amount);
    const side = v.kind === 'CREDIT' ? -1n : 1n;
    if (side * delta < 0n) {
      const [total] = await c.m.query(
        `SELECT coalesce(sum(v.amount),0)::text balance FROM finance_ap_movements v JOIN finance_ap_status d ON d.id=v.document_id
        WHERE v.item_id=$1 AND d.state NOT IN ('CANCELLED','REJECTED') AND (d.posted_date<=$2 OR CASE WHEN $3 THEN v.amount>0 ELSE v.amount<0 END)`,
        [v.item_id, c.input.date, v.kind === 'CREDIT'],
      );
      if (side * signed(total.balance) < -side * delta)
        conflict(
          'Reverse dependent payments or adjustments before reversing this document.',
        );
    }
    move(p, c, v.item_id, delta, -signed(v.withholding));
  }
  if (original.settlement) {
    p.details.bankAmount = cashKinds.includes(original.kind)
      ? original.amount
      : (original.data.details.bankAmount ??
        original.data.details.cashReturned);
    p.bankId = original.data.bankId;
    p.bankAccount = original.data.bankAccount;
  }
  p.amount = original.amount;
  return p;
}
