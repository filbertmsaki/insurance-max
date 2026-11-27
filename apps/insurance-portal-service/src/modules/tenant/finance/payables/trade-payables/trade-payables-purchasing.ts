import { checkBillCredits } from './trade-payables-credit';
import {
  fromMinor,
  moneyMinor,
} from '../../accounting/general-ledger/finance-gl-program';
import {
  activeMaster,
  basePlan,
  conflict,
  current,
  date,
  distinct,
  fail,
  int,
  line,
  list,
  move,
  outstanding,
  plusDays,
  positive,
  record,
  role,
  rootId,
  rounded,
  terms,
  text,
  uuid,
  type Context,
  type Fields,
  type Prepared,
} from './trade-payables.types';

export async function settings(c: Context) {
  const cfg = await current(c.m, c.b.book_id, 'SETTINGS', 'AP');
  if (!cfg) conflict('Approve the accounts payable settings for this book.');
  return cfg.data.details;
}
export async function relatedCompanies(m: Context['m'], b: Context['b']) {
  const assignments =
    (
      b.controls as unknown as {
        termAssignments?: {
          party: string;
          partyId: string;
          termCode: string;
        }[];
      }
    ).termAssignments ?? [];
  const rows = await m.query(
    `SELECT c.id,c.name,c.tin,c.default_currency AS currency,c.contact_email AS email,c.contact_phone AS phone,
    c.settings->'payment_details'->>'vrn' vrn,concat_ws(', ',c.address->>'street',c.address->>'city',c.address->>'country') address
    FROM companies c WHERE c.status='active' AND c.deleted_at IS NULL AND c.id<>$1 AND
    (c.id=ANY($2::uuid[]) OR EXISTS(SELECT 1 FROM insurance_company_partners p WHERE p.deleted_at IS NULL AND p.status='ACTIVE' AND
    (p.start_date IS NULL OR p.start_date<=CURRENT_DATE) AND (p.end_date IS NULL OR p.end_date>=CURRENT_DATE) AND
    ((p.insurer_company_id=$1 AND p.intermediary_company_id=c.id) OR (p.intermediary_company_id=$1 AND p.insurer_company_id=c.id)))) ORDER BY c.name`,
    [
      b.company_id,
      assignments.filter((v) => v.party === 'SUPPLIER').map((v) => v.partyId),
    ],
  );
  return rows.map((r) => ({
    ...r,
    termCode: assignments.find(
      (v) => v.party === 'SUPPLIER' && v.partyId === r.id,
    )?.termCode,
  }));
}
export function receivingRoles(b: Context['b'], chart: Context['chart']) {
  const methods = b.controls.paymentMethods as {
    accountCode: string;
    direction?: string;
  }[];
  return chart.roles
    .filter(
      (r) =>
        r.accountType === 'ASSET' &&
        methods.some(
          (m) =>
            m.accountCode === r.accountCode &&
            ['BOTH', 'INCOMING'].includes(m.direction ?? ''),
        ),
    )
    .map((r) => ({ code: r.code, accountCode: r.accountCode }));
}
export function settlementRole(c: Context, value: unknown, incoming = false) {
  const r = role(c, value, ['ASSET']);
  const methods = c.b.controls.paymentMethods as {
    accountCode: string;
    direction?: string;
  }[];
  if (
    !methods.some(
      (m) =>
        m.accountCode === r.accountCode &&
        ['BOTH', incoming ? 'INCOMING' : 'OUTGOING'].includes(
          m.direction ?? '',
        ),
    )
  )
    fail('Choose a settlement account enabled for this direction in FIN-01.');
  return r;
}
function optional(v: unknown, label: string, max = 160) {
  return v === null || v === undefined || v === '' ? '' : text(v, label, max);
}
export async function master(c: Context) {
  const { kind, details: d } = c.input;
  const root = c.input.replacesId
    ? rootId(await record(c.m, c.b.book_id, c.input.replacesId))
    : c.id;
  const common = { rootId: root, disabled: d.disabled === true };
  if (kind === 'SETTINGS') {
    if (c.input.reference !== 'AP') fail('Use AP as the settings reference.');
    const rules =
      Array.isArray(d.taxRules) && !d.taxRules.length
        ? []
        : list(d.taxRules, 'tax rules').map((r) => ({
            supplierClass: text(r.supplierClass, 'supplier tax class'),
            transactionClass: text(r.transactionClass, 'transaction tax class'),
            vatBps: int(r.vatBps, 'input VAT basis points', 10000),
            recoverableVatBps: int(
              r.recoverableVatBps ?? 10000,
              'recoverable share of VAT',
              10000,
            ),
            withholdingBase: ['NET', 'GROSS'].includes(
              r.withholdingBase ?? 'NET',
            )
              ? (r.withholdingBase ?? 'NET')
              : fail('Choose a net or gross withholding base.'),
            withholdingBps: int(
              r.withholdingBps,
              'withholding basis points',
              10000,
            ),
          }));
    distinct(
      rules.map((r) => JSON.stringify([r.supplierClass, r.transactionClass])),
      'tax classification',
    );
    return basePlan(c, {
      ...common,
      payableRole: role(c, d.payableRole, ['LIABILITY']).code,
      employeePayableRole: role(c, d.employeePayableRole, ['LIABILITY']).code,
      advanceRole: role(c, d.advanceRole, ['ASSET']).code,
      imprestRole: role(c, d.imprestRole, ['ASSET']).code,
      vatRole: role(c, d.vatRole, ['ASSET']).code,
      withholdingRole: role(c, d.withholdingRole, ['LIABILITY']).code,
      discountRole: role(c, d.discountRole, ['INCOME', 'EXPENSE']).code,
      bankRole: settlementRole(c, d.bankRole).code,
      taxRules: rules,
    });
  }
  if (kind === 'CATEGORY')
    return basePlan(c, {
      ...common,
      name: text(d.name, 'category name'),
      matchOrder: d.matchOrder === true,
    });
  if (kind === 'BANK') {
    if (!c.party) fail('Select the beneficiary for this bank account.');
    return basePlan(c, {
      ...common,
      bankName: text(d.bankName, 'bank name'),
      accountName: text(d.accountName, 'account holder'),
      accountNumber: text(d.accountNumber, 'bank account number', 64),
      branch: optional(d.branch, 'bank branch'),
      swift: optional(d.swift, 'SWIFT', 16),
    });
  }
  const category = await activeMaster(c, d.categoryId, 'CATEGORY'),
    cfg = await settings(c);
  const linked = d.registeredCompanyId
    ? (await relatedCompanies(c.m, c.b)).find(
        (x) => x.id === d.registeredCompanyId,
      )
    : null;
  if (d.registeredCompanyId && !linked)
    fail(
      'Select a company with an approved relationship or supplier term assignment.',
    );
  const termCode = d.termCode || linked?.termCode;
  const term = terms(c.b).find((t) =>
    termCode ? t.code === termCode : t.isDefault,
  );
  if (!term) fail('Choose an approved supplier payment term.');
  if (!cfg.taxRules.some((r: Fields) => r.supplierClass === d.taxClass))
    fail('Choose a supplier tax classification with an approved rule.');
  const email = optional(d.email, 'email', 254),
    phone = optional(d.phone, 'phone', 60);
  if (!email && !phone) fail('Enter a supplier email or phone.');
  return basePlan(c, {
    ...common,
    registeredCompanyId: linked?.id ?? null,
    name: text(d.name, 'supplier name'),
    categoryId: rootId(category),
    tin: text(d.tin, 'TIN', 50),
    vrn: optional(d.vrn, 'VRN', 50),
    address: text(d.address, 'address', 500),
    email,
    phone,
    taxClass: d.taxClass,
    payableRole: role(c, d.payableRole || cfg.payableRole, ['LIABILITY']).code,
    termCode: term.code,
    monthlyDueDay: d.monthlyDueDay
      ? int(d.monthlyDueDay, 'monthly due day', 31)
      : 0,
    discountDays: int(d.discountDays ?? 0, 'discount days', 365),
    discountBps: int(d.discountBps ?? 0, 'early settlement discount', 9999),
  });
}
export async function supplier(c: Context) {
  const s = await activeMaster(c, c.input.supplierId, 'SUPPLIER');
  return s;
}
function purchaseLines(
  c: Context,
  supplierClass?: string,
  rules: Fields[] = [],
) {
  const rows = list(c.input.details.lines, 'invoice or order lines').map(
    (l) => {
      const item = text(l.item, 'item code', 60),
        quantity = positive(l.quantity, 6, 'quantity'),
        unit = positive(l.unitPrice, c.scale, 'unit price');
      const net = rounded(quantity * unit, 1000000n);
      if (net <= 0n)
        fail('Each line must have a positive value in the document currency.');
      const transactionClass = supplierClass
        ? text(l.transactionClass, 'transaction classification')
        : '';
      const tax = rules.find(
        (r) =>
          r.supplierClass === supplierClass &&
          r.transactionClass === transactionClass,
      );
      if (supplierClass && !tax)
        fail(
          'No approved tax rule covers this supplier and transaction classification.',
        );
      const vat = rounded(net * BigInt(tax?.vatBps ?? 0), 10000n);
      const recoverable = rounded(
        vat * BigInt(tax?.recoverableVatBps ?? 10000),
        10000n,
      );
      const withholdingBase =
        tax?.withholdingBase === 'GROSS' ? net + vat : net;
      return {
        item,
        description: text(l.description, 'line description', 500),
        role: role(
          c,
          l.role,
          c.input.kind === 'EXPENSE' || c.input.kind === 'RETIREMENT'
            ? ['EXPENSE']
            : ['ASSET', 'EXPENSE'],
        ).code,
        quantity: fromMinor(quantity, 6),
        unitPrice: fromMinor(unit, c.scale),
        transactionClass,
        net: fromMinor(net, c.scale),
        vat: fromMinor(vat, c.scale),
        recoverableVat: fromMinor(recoverable, c.scale),
        withholding: fromMinor(
          rounded(withholdingBase * BigInt(tax?.withholdingBps ?? 0), 10000n),
          c.scale,
        ),
      };
    },
  );
  distinct(
    rows.map((r) => r.item),
    'item code',
  );
  return rows;
}
async function orderMatch(c: Context, p: Prepared, receipt: boolean) {
  const order = await record(c.m, c.b.book_id, c.input.details.orderId);
  if (
    order.kind !== 'ORDER' ||
    order.state !== 'APPROVED' ||
    order.party !== c.party ||
    order.currency !== c.input.currency ||
    order.doc_date > c.input.date
  )
    conflict('Choose an approved order for this supplier, date and currency.');
  const rows = await c.m.query(
    `SELECT q.item,
    coalesce(sum(q.quantity) FILTER(WHERE d.kind='RECEIPT' AND d.state='APPROVED' AND d.doc_date<=$3),0)::text received,
    coalesce(sum(q.quantity) FILTER(WHERE d.kind='RECEIPT'),0)::text booked,
    coalesce(sum(q.quantity) FILTER(WHERE d.kind='BILL'),0)::text billed
    FROM finance_ap_order_quantities q JOIN finance_ap_records d ON d.id=q.document_id
    WHERE q.book_id=$1 AND q.order_id=$2 AND d.state NOT IN ('REJECTED','CANCELLED')
      AND NOT EXISTS(SELECT 1 FROM finance_ap_status rev WHERE rev.book_id=q.book_id AND rev.kind='REVERSAL' AND rev.data->'details'->>'originalId'=d.id::text AND rev.posted_date<=$3)
    GROUP BY q.item`,
    [c.b.book_id, order.id, c.input.date],
  );
  for (const l of p.details.lines) {
    const source = order.data.details.lines.find(
        (x: Fields) => x.item === l.item,
      ),
      existing = rows.find((x) => x.item === l.item);
    if (!source) fail('An item is absent from the order.');
    const available = receipt
      ? moneyMinor(source.quantity, 6) - moneyMinor(existing?.booked ?? '0', 6)
      : moneyMinor(existing?.received ?? '0', 6) -
        moneyMinor(existing?.billed ?? '0', 6);
    if (
      moneyMinor(l.quantity, 6) > available ||
      (!receipt &&
        (l.unitPrice !== source.unitPrice ||
          l.role !== source.role ||
          l.transactionClass !== source.transactionClass))
    )
      conflict(
        'The quantity, price, account or tax classification does not match the order and accepted deliveries.',
      );
  }
  p.quantities = p.details.lines.map((l: Fields) => ({
    item: l.item,
    quantity: l.quantity,
  }));
  p.orderId = order.id;
}
export async function purchasing(c: Context) {
  const { kind, details: d } = c.input,
    cfg = await settings(c);
  const staff = kind === 'EXPENSE' || kind === 'RETIREMENT';
  const s = staff ? null : await supplier(c);
  const sd = s?.data.details;
  const p = basePlan(c, {
    description: text(d.description, 'description', 500),
  });
  if (kind === 'RECEIPT') {
    p.details.lines = list(d.lines, 'delivery lines').map((l) => ({
      item: text(l.item, 'order item'),
      quantity: fromMinor(positive(l.quantity, 6), 6),
    }));
    distinct(
      p.details.lines.map((l: Fields) => l.item),
      'received item',
    );
    await orderMatch(c, p, true);
    return p;
  }
  const rows =
    kind === 'RETIREMENT' && Array.isArray(d.lines) && d.lines.length === 0
      ? []
      : purchaseLines(c, sd?.taxClass, cfg.taxRules);
  p.details.lines = rows;
  const payable = sd?.payableRole ?? cfg.employeePayableRole;
  p.details.controlRole = payable;
  p.details.controlAccount = role(c, payable, ['LIABILITY']).accountCode;
  p.details.withholdingRole = cfg.withholdingRole;
  let gross = 0n,
    wht = 0n;
  const reverse = kind === 'CREDIT';
  for (const l of rows) {
    const net = moneyMinor(l.net, c.scale),
      vat = moneyMinor(l.vat, c.scale);
    gross += net + vat;
    wht += moneyMinor(l.withholding, c.scale);
    const recoverable = moneyMinor(l.recoverableVat, c.scale);
    line(p, c, l.role, reverse ? 'credit' : 'debit', net + vat - recoverable);
    line(p, c, cfg.vatRole, reverse ? 'credit' : 'debit', recoverable);
  }
  p.amount = fromMinor(gross, c.scale);
  if (kind === 'ORDER') {
    p.lines = [];
    return p;
  }
  if (kind === 'BILL') {
    const cat = await activeMaster(c, sd!.categoryId, 'CATEGORY');
    if (cat.data.details.matchOrder || d.orderId) await orderMatch(c, p, false);
  }
  if (kind === 'RETIREMENT') {
    const parent = await outstanding(c, d.itemId, ['IMPREST']);
    const returned = moneyMinor(d.cashReturned || '0', c.scale);
    if (
      parent.balance <= 0n ||
      gross + returned <= 0n ||
      (returned > 0n && gross + returned > parent.balance)
    )
      conflict('Choose an unsettled imprest and return only unused cash.');
    const retired =
      gross + returned > parent.balance ? parent.balance : gross + returned;
    const excess = gross + returned - retired;
    p.details.itemId = parent.item.id;
    p.details.cashReturned = fromMinor(returned, c.scale);
    if (returned > 0n) {
      const bank = settlementRole(c, d.bankRole || cfg.bankRole, true);
      p.bankAccount = bank.accountCode!;
      line(p, c, bank.code, 'debit', returned);
    }
    line(p, c, parent.item.data.details.assetRole, 'credit', retired);
    p.details.employeeReimbursement = fromMinor(excess, c.scale);
    if (excess) {
      line(p, c, payable, 'credit', excess);
      move(p, c, c.id, excess);
      p.due = c.input.date;
    }
    p.amount = fromMinor(gross + returned, c.scale);
    move(p, c, parent.item.id, -retired);
    return p;
  }
  if (kind === 'CREDIT' || kind === 'DEBIT') {
    const parent = await outstanding(c, d.itemId, ['BILL']);
    const original = parent.item.data.details;
    p.details.itemId = parent.item.id;
    p.details.controlRole = original.controlRole;
    p.details.controlAccount = original.controlAccount;
    if (original.withholdingRole !== cfg.withholdingRole)
      conflict('Use the original bill withholding account for its adjustment.');
    if (reverse) {
      await checkBillCredits(
        c.m,
        c.b.book_id,
        parent.item.id,
        c.input.date,
        p.amount,
      );
      const applied = gross < parent.balance ? gross : parent.balance;
      let withheld =
        applied === parent.balance
          ? parent.withholding
          : rounded(wht * applied, gross);
      if (withheld > parent.withholding) withheld = parent.withholding;
      if (
        withheld > applied ||
        parent.withholding - withheld > parent.balance - applied
      )
        conflict(
          'Review the withholding adjustment for the remaining invoice balance.',
        );
      move(p, c, parent.item.id, -applied, -withheld);
      const carry = gross - applied;
      if (carry > 0n) move(p, c, c.id, -carry);
      p.details.appliedToInvoice = fromMinor(applied, c.scale);
      p.details.availableCredit = fromMinor(carry, c.scale);
      p.due = c.input.date;
    } else {
      move(p, c, parent.item.id, gross, wht);
    }
  } else {
    let days = 0;
    if (sd) {
      const t = terms(c.b).find((t) => t.code === sd.termCode);
      if (!t) conflict('Review the supplier payment terms.');
      days = t.days;
      p.details.termCode = t.code;
      p.details.discountBps = sd.discountBps;
      p.details.discountUntil = plusDays(c.input.date, sd.discountDays);
    }
    p.due = plusDays(c.input.date, days);
    if (sd?.monthlyDueDay) {
      const due = new Date(c.input.date + 'T00:00:00Z');
      const next =
        due.getUTCMonth() + (due.getUTCDate() > sd.monthlyDueDay ? 1 : 0);
      due.setUTCDate(1);
      due.setUTCMonth(next + 1, 0);
      due.setUTCDate(Math.min(sd.monthlyDueDay, due.getUTCDate()));
      p.due = due.toISOString().slice(0, 10);
    }
    move(p, c, c.id, gross, wht);
  }
  line(p, c, p.details.controlRole, reverse ? 'debit' : 'credit', gross);
  return p;
}
