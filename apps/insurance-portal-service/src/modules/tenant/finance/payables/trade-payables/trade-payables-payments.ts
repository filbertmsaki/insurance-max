import {
  fromMinor,
  moneyMinor,
} from '../../accounting/general-ledger/finance-gl-program';
import {
  activeMaster,
  basePlan,
  cashKinds,
  conflict,
  date,
  distinct,
  fail,
  line,
  list,
  move,
  outstanding,
  positive,
  record,
  role,
  rounded,
  text,
  uuid,
  type Context,
  type Fields,
} from './trade-payables.types';
import {
  settings,
  settlementRole,
  supplier,
} from './trade-payables-purchasing';

export async function payment(c: Context) {
  const { kind, details: d } = c.input,
    cfg = await settings(c);
  if (c.input.supplierId) await supplier(c);
  const p = basePlan(c, {
    description: text(d.description, 'payment purpose', 500),
  });
  if (kind === 'SUPPLIER_REFUND') {
    const { item, balance } = await outstanding(c, d.creditId, ['CREDIT']);
    const amount = positive(d.amount, c.scale);
    if (amount > balance)
      conflict('The refund exceeds the available supplier credit.');
    const bank = settlementRole(c, d.bankRole || cfg.bankRole, true);
    p.bankAccount = bank.accountCode!;
    p.amount = fromMinor(amount, c.scale);
    p.details.creditId = item.id;
    p.details.bankRole = bank.code;
    p.details.bankAmount = p.amount;
    line(p, c, bank.code, 'debit', amount);
    line(p, c, item.data.details.controlRole, 'credit', amount);
    move(p, c, item.id, amount);
    return p;
  }
  const bank = cashKinds.includes(kind)
    ? settlementRole(c, d.bankRole || cfg.bankRole)
    : undefined;
  if (bank) {
    const beneficiary = await activeMaster(c, d.bankId, 'BANK');
    if (
      beneficiary.id !== d.bankId ||
      beneficiary.party !== c.party ||
      beneficiary.currency !== c.input.currency
    )
      conflict(
        'Select the current approved beneficiary account in the payment currency.',
      );
    p.bankId = beneficiary.id;
    p.bankAccount = bank.accountCode!;
    p.details.bankRole = bank.code;
    p.due = date(d.scheduledDate || c.input.date);
    if (p.due < c.input.date)
      fail('Schedule payment on or after the request date.');
  }
  if (kind === 'ADVANCE' || kind === 'IMPREST') {
    const amount = positive(d.amount, c.scale),
      asset = kind === 'ADVANCE' ? cfg.advanceRole : cfg.imprestRole;
    p.details.assetRole = role(c, asset, ['ASSET']).code;
    p.amount = fromMinor(amount, c.scale);
    line(p, c, asset, 'debit', amount);
    line(p, c, bank!.code, 'credit', amount);
    move(p, c, c.id, amount);
    return p;
  }
  const allocations = list(d.allocations, 'bill allocations');
  distinct(
    allocations.map((a) => uuid(a.itemId, 'open bill')),
    'bill allocation',
  );
  const entries: Fields[] = [];
  let net = 0n,
    discount = 0n;
  for (const a of allocations) {
    const { item, balance, withholding } = await outstanding(c, a.itemId, [
      'BILL',
      'EXPENSE',
      'RETIREMENT',
    ]);
    const gross = positive(a.amount, c.scale);
    if (gross > balance)
      conflict('Allocation exceeds the unreserved bill balance.');
    const withheld =
      gross === balance ? withholding : rounded(withholding * gross, balance);
    const policy = item.data.details;
    let saved = 0n;
    if (
      d.takeDiscount === true &&
      kind === 'PAYMENT' &&
      policy.discountBps &&
      p.due! <= policy.discountUntil
    ) {
      saved = rounded((gross - withheld) * BigInt(policy.discountBps), 10000n);
      p.details.discountUntil = [p.details.discountUntil, policy.discountUntil]
        .filter(Boolean)
        .sort()[0];
    }
    const allocatedNet = gross - withheld - saved;
    if (allocatedNet < 0n) fail('Deductions exceed the selected allocation.');
    net += allocatedNet;
    discount += saved;
    line(p, c, policy.controlRole, 'debit', gross);
    line(p, c, policy.withholdingRole, 'credit', withheld);
    move(p, c, item.id, -gross, -withheld);
    entries.push({
      itemId: item.id,
      reference: item.reference,
      gross: fromMinor(gross, c.scale),
      withheld: fromMinor(withheld, c.scale),
      discount: fromMinor(saved, c.scale),
      net: fromMinor(allocatedNet, c.scale),
    });
  }
  p.details.allocations = entries;
  p.details.takeDiscount = d.takeDiscount === true;
  if (kind === 'APPLICATION' || kind === 'CREDIT_APPLICATION') {
    const credit = kind === 'CREDIT_APPLICATION';
    const { item, balance } = await outstanding(
      c,
      credit ? d.creditId : d.advanceId,
      [credit ? 'CREDIT' : 'ADVANCE'],
    );
    if (net <= 0n || net > balance)
      conflict(
        'The net allocation must fit the available supplier credit or advance.',
      );
    move(p, c, item.id, credit ? net : -net);
    line(
      p,
      c,
      credit ? item.data.details.controlRole : item.data.details.assetRole,
      'credit',
      net,
    );
    p.details[credit ? 'creditId' : 'advanceId'] = item.id;
  } else {
    line(p, c, bank!.code, 'credit', net);
    line(p, c, cfg.discountRole, 'credit', discount);
  }
  p.amount = fromMinor(net, c.scale);
  return p;
}
export async function activeBatch(c: Pick<Context, 'm' | 'b'>, id: string) {
  const [batch] = await c.m.query(
    `SELECT d.* FROM finance_ap_batch_items i JOIN finance_ap_records d ON d.id=i.batch_id
    WHERE i.book_id=$1 AND i.payment_id=$2 AND d.state IN ('PENDING','APPROVED')`,
    [c.b.book_id, id],
  );
  return batch;
}
export async function batch(c: Context) {
  const ids = list<string>(
    c.input.details.payments,
    'payment vouchers',
    100,
    true,
  ).map((x) => uuid(x, 'payment voucher'));
  distinct(ids, 'payment voucher');
  const p = basePlan(c, {
    description: text(c.input.details.description, 'batch description'),
  });
  p.batchItems = ids;
  let total = 0n;
  for (const id of ids) {
    const r = await record(c.m, c.b.book_id, id);
    if (
      !cashKinds.includes(r.kind) ||
      r.status !== 'APPROVED' ||
      r.currency !== c.input.currency ||
      r.due_date! > c.input.date ||
      (await activeBatch(c, id))
    )
      conflict(
        'Choose approved, unbatched vouchers due by the batch date in one currency.',
      );
    total += moneyMinor(r.amount, c.scale);
  }
  p.amount = fromMinor(total, c.scale);
  return p;
}
