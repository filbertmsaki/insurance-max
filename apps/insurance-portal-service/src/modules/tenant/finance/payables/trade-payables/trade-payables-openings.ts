import { randomUUID } from 'node:crypto';
import { DecimalUtil } from '../../../../shared/finance/decimal.util';
import { financeConfigurationHash as hash } from '../../foundation/finance-configuration/finance-configuration.types';
import { certifiedOpening } from '../../accounting/general-ledger/finance-gl-balances';
import {
  fromMinor,
  moneyMinor,
} from '../../accounting/general-ledger/finance-gl-program';
import { tieOut } from './trade-payables-reports';
import { settings } from './trade-payables-purchasing';
import {
  basePlan,
  conflict,
  current,
  date,
  distinct,
  fail,
  int,
  list,
  positive,
  role,
  rootId,
  text,
  type ApRecord,
  type Context,
} from './trade-payables.types';

interface OpeningLine {
  documentType: 'BILL' | 'CREDIT';
  creditableAmount: string;
  supplierCode: string;
  supplierId: string;
  supplierVersion: string;
  reference: string;
  invoiceDate: string;
  dueDate: string;
  currency: string;
  amount: string;
  functionalAmount: string;
  withholding: string;
  discountBps: number;
  discountUntil: string | null;
}

export async function openingImport(c: Context) {
  const cfg = await settings(c);
  const control = role(c, c.input.details.controlRole || cfg.payableRole, [
    'LIABILITY',
  ]);
  const cutoff = c.input.date;
  const functional = c.b.context.functionalCurrency;
  if (c.input.currency !== functional)
    fail(
      'Use the book currency for the import total and each invoice currency on its own line.',
    );
  const [clock] = await c.m.query(
    'SELECT (statement_timestamp() AT TIME ZONE $1)::date::text AS day',
    [c.b.timezone],
  );
  if (cutoff > clock.day)
    fail('The opening cutover date cannot be in the future.');
  const certificate = await certifiedOpening(c.m, c.b.book_id, cutoff);
  const [prior] = await c.m.query(
    `SELECT id FROM finance_ap_records WHERE book_id=$1 AND kind='OPENING_IMPORT' AND state IN ('PENDING','APPROVED') AND data->'details'->>'controlAccount'=$2 AND id<>$3`,
    [c.b.book_id, control.accountCode, c.id],
  );
  if (prior)
    conflict('An opening import already exists for this control account.');
  const account = (
    await tieOut(c.m, c.b.book_id, cutoff, control.accountCode)
  ).find((x) => x.account === control.accountCode);
  if (!account || account.unresolvedConversion)
    conflict(
      'Resolve the functional balance of this control account before allocating opening items.',
    );
  const suppliers = new Map<string, ApRecord>();
  const lines: OpeningLine[] = [];
  let invoices = 0n,
    credits = 0n;
  for (const entry of list(c.input.details.lines, 'opening invoices', 5000)) {
    const code = text(entry.supplierCode, 'supplier code', 100).toUpperCase();
    let supplier = suppliers.get(code);
    if (!supplier) {
      supplier = await current(c.m, c.b.book_id, 'SUPPLIER', code);
      if (
        !supplier ||
        supplier.data.details.disabled ||
        role(c, supplier.data.details.payableRole, ['LIABILITY'])
          .accountCode !== control.accountCode
      )
        conflict(
          'Choose an active supplier on the selected payable account for ' +
            code +
            '.',
        );
      suppliers.set(code, supplier);
    }
    const reference = text(entry.reference, 'supplier invoice number', 100);
    const documentType = entry.documentType || 'BILL';
    if (documentType !== 'BILL' && documentType !== 'CREDIT')
      fail('Select BILL or CREDIT for ' + reference + '.');
    const invoiceDate = date(entry.invoiceDate),
      dueDate = date(
        entry.dueDate || (documentType === 'CREDIT' ? invoiceDate : ''),
      );
    if (invoiceDate > cutoff || dueDate < invoiceDate)
      fail('Check the invoice, due and cutover dates for ' + reference + '.');
    const currency = text(entry.currency, 'invoice currency', 10);
    if (!Object.hasOwn(c.b.context.currencyScales, currency))
      fail('Choose a book currency for ' + reference + '.');
    const scale = c.b.context.currencyScales[currency];
    const amount = positive(entry.amount, scale);
    const creditableAmount = entry.creditableAmount
      ? positive(
          entry.creditableAmount,
          scale,
          'remaining value eligible for credit',
        )
      : amount;
    if (creditableAmount < amount)
      fail('The creditable invoice value must cover the outstanding balance.');
    const carrying =
      currency === functional && !entry.functionalAmount
        ? amount
        : positive(
            entry.functionalAmount,
            c.scale,
            'functional carrying amount',
          );
    if (currency === functional && amount !== carrying)
      fail('The two amounts must agree for a book-currency invoice.');
    const withholding = moneyMinor(
      text(entry.withholding || '0', 'remaining withholding'),
      scale,
    );
    if (withholding > amount)
      fail('Remaining withholding exceeds the outstanding invoice.');
    const bps = int(
      Number(entry.discountBps || 0),
      'discount basis points',
      9999,
    );
    const until = bps ? date(entry.discountUntil) : null;
    if (
      documentType === 'CREDIT' &&
      (withholding || bps || creditableAmount !== amount)
    )
      fail(
        'A carried supplier credit uses its available amount without withholding or an early-payment discount.',
      );
    if (until && until < invoiceDate)
      fail('The discount cannot expire before the invoice date.');
    if (documentType === 'CREDIT') credits += carrying;
    else invoices += carrying;
    lines.push({
      documentType,
      creditableAmount: fromMinor(creditableAmount, scale),
      supplierCode: supplier.reference,
      supplierId: rootId(supplier),
      supplierVersion: supplier.id,
      reference,
      invoiceDate,
      dueDate,
      currency,
      amount: fromMinor(amount, scale),
      functionalAmount: fromMinor(carrying, c.scale),
      withholding: fromMinor(withholding, scale),
      discountBps: bps,
      discountUntil: until,
    });
  }
  distinct(
    lines.map(
      (l) =>
        l.supplierId + '/' + l.documentType + '/' + l.reference.toUpperCase(),
    ),
    'opening invoice for a supplier',
  );
  const [duplicate] = await c.m.query(
    `SELECT d.reference FROM jsonb_to_recordset($2::jsonb) l("supplierId" text,"documentType" text,reference text)
    JOIN finance_ap_records d ON d.book_id=$1 AND d.kind=l."documentType" AND d.party='S:'||l."supplierId" AND upper(d.reference)=upper(l.reference)
    WHERE d.state NOT IN ('CANCELLED','REJECTED') LIMIT 1`,
    [c.b.book_id, JSON.stringify(lines)],
  );
  if (duplicate)
    conflict(
      'An invoice already uses supplier reference ' + duplicate.reference + '.',
    );
  const net = fromMinor(invoices - credits, c.scale);
  if (!DecimalUtil.value(account.difference).eq(net))
    conflict(
      'The functional total must equal the unallocated GL balance of ' +
        DecimalUtil.value(account.difference).toFixed() +
        ' ' +
        functional +
        '.',
    );
  const p = basePlan(c, {
    description: text(c.input.details.description, 'cutover description', 500),
    controlRole: control.code,
    controlAccount: control.accountCode,
    withholdingRole: role(c, cfg.withholdingRole, ['LIABILITY']).code,
    certificateId: certificate.id,
    invoiceTotal: fromMinor(invoices, c.scale),
    creditTotal: fromMinor(credits, c.scale),
    netOpening: net,
    glBalance: account.generalLedger,
    subledgerBefore: account.supplierLedger,
    lines,
  });
  p.amount = fromMinor(invoices > credits ? invoices : credits, c.scale);
  return p;
}

export async function approveOpening(
  c: Context,
  r: ApRecord,
  reviewer: {
    naturalPersonId: string;
    sourceUserId?: string;
    subjectId: string;
  },
  reason: string,
) {
  if (!reviewer.sourceUserId)
    conflict(
      'A bound reviewer identity is required to approve an opening import.',
    );
  const checked = await openingImport(c);
  if (
    hash(checked.details) !== hash(r.data.details) ||
    moneyMinor(checked.amount, c.scale) !== moneyMinor(r.amount, c.scale)
  )
    conflict(
      'The opening, account mapping or source balance changed. Submit the reconciled import again.',
    );
  const d = checked.details;
  const rows = (d.lines as OpeningLine[]).map((l) => {
    const id = randomUUID();
    const data = basePlan(c, {
      description: 'Opening supplier item ' + l.reference,
      ...(l.documentType === 'CREDIT'
        ? { availableCredit: l.amount }
        : { creditableAmount: l.creditableAmount }),
      openingImportId: r.id,
      controlRole: d.controlRole,
      controlAccount: d.controlAccount,
      withholdingRole: d.withholdingRole,
      discountBps: l.discountBps,
      discountUntil: l.discountUntil,
    });
    data.accounts = { [d.controlRole]: d.controlAccount };
    data.amount = l.amount;
    data.due = l.dueDate;
    const movement = l.documentType === 'CREDIT' ? '-' + l.amount : l.amount;
    data.movements = [
      { itemId: id, amount: movement, withholding: l.withholding },
    ];
    return {
      ...l,
      id,
      movement,
      carrying:
        l.documentType === 'CREDIT'
          ? '-' + l.functionalAmount
          : l.functionalAmount,
      key: randomUUID(),
      sourceHash: hash({ importId: r.id, line: l }),
      data,
    };
  });
  const encoded = JSON.stringify(rows);
  await c.m.query(
    `INSERT INTO finance_ap_records(id,book_id,kind,reference,party,request_key,request_hash,data,doc_date,due_date,currency,amount,
    maker_id,maker_person,state,reviewer_person,reviewer_user_id,review_reason,reviewed_at)
    SELECT l.id,$1,l."documentType",l.reference,'S:'||l."supplierId",l.key,l."sourceHash",l.data,l."invoiceDate",l."dueDate",l.currency,l.amount,
    $3,$4,'APPROVED',$5,$6,$7,statement_timestamp() FROM jsonb_to_recordset($2::jsonb) l(id uuid,key uuid,"documentType" text,"sourceHash" text,reference text,"supplierId" text,
    data jsonb,"invoiceDate" date,"dueDate" date,currency text,amount numeric)`,
    [
      r.book_id,
      encoded,
      r.maker_id,
      r.maker_person,
      reviewer.naturalPersonId,
      reviewer.sourceUserId,
      reason,
    ],
  );
  await c.m.query(
    `INSERT INTO finance_ap_opening_items(book_id,import_id,item_id,functional_amount)
    SELECT $1,$2,id,carrying FROM jsonb_to_recordset($3::jsonb) l(id uuid,carrying numeric)`,
    [r.book_id, r.id, encoded],
  );
  await c.m.query(
    `INSERT INTO finance_ap_movements(book_id,document_id,item_id,amount,withholding)
    SELECT $1,id,id,movement,withholding FROM jsonb_to_recordset($2::jsonb) l(id uuid,movement numeric,withholding numeric)`,
    [r.book_id, encoded],
  );
  await c.m.query(
    `INSERT INTO finance_ap_events(book_id,record_id,action,actor,reason,evidence)
    SELECT $1,item_id,'IMPORT_OPENING',$3,$4,$5 FROM finance_ap_opening_items WHERE book_id=$1 AND import_id=$2`,
    [r.book_id, r.id, reviewer.subjectId, reason, r.data.evidence],
  );
}

export async function voidOpening(
  c: Pick<Context, 'm' | 'b'>,
  batch: ApRecord,
  actor: string,
  reason: string,
  evidence: unknown,
) {
  const [used] = await c.m.query(
    `SELECT 1 FROM finance_ap_opening_items o JOIN finance_ap_movements v ON v.item_id=o.item_id AND v.document_id<>o.item_id
    JOIN finance_ap_records d ON d.id=v.document_id WHERE o.import_id=$1 AND d.state NOT IN ('REJECTED','CANCELLED') LIMIT 1`,
    [batch.id],
  );
  if (used)
    conflict(
      'An imported invoice has subsequent activity. Preserve the import and correct the individual transactions.',
    );
  await c.m.query(
    "UPDATE finance_ap_records SET state='CANCELLED' WHERE id=$1",
    [batch.id],
  );
  await c.m.query(
    `UPDATE finance_ap_records d SET state='CANCELLED' FROM finance_ap_opening_items o WHERE o.import_id=$1 AND o.item_id=d.id`,
    [batch.id],
  );
  await c.m.query(
    `INSERT INTO finance_ap_events(book_id,record_id,action,actor,reason,evidence)
    SELECT book_id,item_id,'VOID_OPENING', $2,$3,$4 FROM finance_ap_opening_items WHERE import_id=$1`,
    [batch.id, actor, reason, evidence],
  );
}
