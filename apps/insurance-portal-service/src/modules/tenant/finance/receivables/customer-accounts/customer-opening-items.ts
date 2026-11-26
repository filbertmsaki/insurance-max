import type { EntityManager } from 'typeorm';
import { DecimalUtil } from '../../../../shared/finance/decimal.util';
import type { ActivePostingBook } from '../../accounting/general-ledger/finance-book-request';
import { controlReport } from './customer-account-reports';
import {
  conflict,
  day,
  document,
  invalid,
  text,
  type ArDocument,
  type ArInput,
} from './customer-accounts.types';

export async function prepareCustomerOpening(
  m: EntityManager,
  b: ActivePostingBook,
  v: ArInput,
) {
  const rows = v.openingItems;
  if (!Array.isArray(rows) || !rows.length || rows.length > 5000)
    invalid('Import between one and 5,000 outstanding invoices.');
  const scale = Math.min(4, b.context.currencyScales[v.currency]);
  const keys = new Set<string>();
  let total = DecimalUtil.value(0);
  const items = rows.map((row) => {
    const customerCode = text(
        row?.customerCode,
        'customer code',
        100,
      ).toUpperCase(),
      reference = text(row.reference, 'external invoice reference', 120);
    const invoiceDate = day(row.invoiceDate),
      dueDate = day(row.dueDate);
    if (invoiceDate > v.date || dueDate < invoiceDate)
      invalid('Check invoice and due dates for ' + reference + '.');
    if (
      typeof row.amount !== 'string' ||
      !/^\d{1,16}(\.\d{1,4})?$/.test(row.amount)
    )
      invalid('Enter a positive outstanding amount for ' + reference + '.');
    const amount = DecimalUtil.value(row.amount);
    if (amount.lte(0) || amount.dp() > scale)
      invalid('Check the amount and currency precision for ' + reference + '.');
    const key = JSON.stringify([customerCode, reference.toUpperCase()]);
    if (keys.has(key)) conflict('Duplicate opening invoice ' + reference + '.');
    keys.add(key);
    total = total.plus(amount);
    return {
      customerCode,
      reference,
      invoiceDate,
      dueDate,
      amount: amount.toFixed(),
    };
  });
  const [pending] = await m.query(
    "SELECT id FROM finance_ar_documents WHERE book_id=$1 AND currency=$2 AND kind='OPENING_IMPORT' AND state IN ('PENDING','APPROVED') AND request_key<>$3",
    [b.book_id, v.currency, v.requestKey],
  );
  if (pending)
    conflict(
      'Finish or withdraw the pending opening import for this currency.',
    );
  const [bad] = await m.query(
    `WITH lines AS(SELECT * FROM jsonb_to_recordset($2) AS r("customerCode" text,reference text))
    SELECT reference FROM lines l WHERE (SELECT count(*) FROM customers c WHERE c.company_id=$1 AND upper(c.customer_no)=l."customerCode" AND c.deleted_at IS NULL)<>1
    OR EXISTS(SELECT 1 FROM customers c JOIN invoices i ON i.customer_id=c.id AND i.company_id=c.company_id
      LEFT JOIN finance_ar_opening_items o ON o.invoice_id=i.id WHERE c.company_id=$1 AND upper(c.customer_no)=l."customerCode" AND i.deleted_at IS NULL AND
      (upper(i.invoice_no)=upper(l.reference) OR (o.void_id IS NULL AND upper(o.reference)=upper(l.reference)))) LIMIT 1`,
    [b.company_id, JSON.stringify(items)],
  );
  if (bad)
    conflict(
      'Unknown or ambiguous customer, or an invoice already exists for ' +
        bad.reference +
        '.',
    );
  const customerIds = new Map<string, string>(
    (
      await m.query(
        'SELECT upper(customer_no) code,id FROM customers WHERE company_id=$1 AND upper(customer_no)=ANY($2::text[]) AND deleted_at IS NULL FOR SHARE',
        [b.company_id, [...new Set(items.map((x) => x.customerCode))]],
      )
    ).map((c: { code: string; id: string }) => [c.code, c.id]),
  );
  const control = await controlReport(m, b, v.currency, v.date);
  if (
    !control.account ||
    control.status === 'OPENING_ALLOCATION_REQUIRED' ||
    control.openingDate !== v.date
  )
    conflict(
      'Select the certified opening date and an approved receivables policy with a certified currency allocation.',
    );
  const declared = v.remainingAfterImport ?? '0';
  if (typeof declared !== 'string' || !/^\d{1,16}(\.\d{1,4})?$/.test(declared))
    invalid('Enter the nonnegative balance remaining after this batch.');
  const remaining = DecimalUtil.value(declared);
  if (remaining.dp() > scale)
    invalid('Check the currency precision of the remaining balance.');
  const [prior] = await m.query(
    `SELECT coalesce(sum(o.outstanding),0)::text allocated FROM finance_ar_opening_items o JOIN finance_ar_documents d ON d.id=o.import_id
     WHERE d.book_id=$1 AND o.void_id IS NULL AND o.currency=$2 AND d.data->>'certificateId'=$3 AND d.data->>'controlAccount'=$4`,
    [b.book_id, v.currency, control.certificateId, control.account],
  );
  if (
    total.plus(prior.allocated).gt(control.certifiedBalance) ||
    !total.plus(remaining).eq(control.difference)
  )
    conflict(
      'The batch and declared remainder must reconcile to the unallocated control balance of ' +
        control.difference +
        ' ' +
        v.currency +
        ' within the certified opening.',
    );
  return {
    items: items.map((x) => ({
      ...x,
      customerId: customerIds.get(x.customerCode)!,
    })),
    total: total.toFixed(),
    remaining: remaining.toFixed(),
    certificateId: control.certificateId,
    account: control.account,
  };
}

export async function openingForCorrection(
  m: EntityManager,
  b: ActivePostingBook,
  v: ArInput,
) {
  const original = await document(m, b.book_id, v.relatedId!);
  if (
    original.kind !== 'OPENING_IMPORT' ||
    original.state !== 'POSTED' ||
    v.currency !== original.currency ||
    original.effective_date !== v.date
  )
    conflict(
      'Select the posted import, its currency and original cutover date.',
    );
  const rows = await m.query(
    `SELECT i.id FROM finance_ar_opening_items o JOIN invoices i ON i.id=o.invoice_id
    WHERE o.import_id=$1 ORDER BY i.id FOR UPDATE OF i,o`,
    [original.id],
  );
  const [used] = await m.query(
    `SELECT 1 FROM finance_ar_opening_items o JOIN invoices i ON i.id=o.invoice_id WHERE o.import_id=$1 AND
    (o.void_id IS NOT NULL OR i.status<>'ISSUED' OR i.balance_amount<>o.outstanding OR EXISTS(SELECT 1 FROM receipt_allocations a WHERE a.invoice_id=i.id)
     OR EXISTS(SELECT 1 FROM finance_refunds f WHERE f.invoice_id=i.id) OR EXISTS(SELECT 1 FROM payment_transactions t WHERE t.invoice_id=i.id)
     OR EXISTS(SELECT 1 FROM receipts r WHERE r.invoice_id=i.id) OR EXISTS(SELECT 1 FROM finance_ar_documents d WHERE d.invoice_id=i.id AND d.state NOT IN ('REJECTED','CANCELLED'))
     OR EXISTS(SELECT 1 FROM finance_ar_collection_events e WHERE e.invoice_id=i.id)
     OR EXISTS(SELECT 1 FROM finance_gl_writeoffs w WHERE w.invoice_id=i.id)) LIMIT 1`,
    [original.id],
  );
  if (!rows.length || used)
    conflict(
      'An opening invoice has already been corrected or has dependent activity.',
    );
  return original;
}

// Review, registration and the source audit commit in the same book transaction.
export async function applyCustomerOpening(
  m: EntityManager,
  b: ActivePostingBook,
  r: ArDocument,
  reviewer: string,
) {
  if (r.kind === 'OPENING_VOID') {
    await openingForCorrection(m, b, r.data);
    await m.query(
      'UPDATE finance_ar_opening_items SET void_id=$2 WHERE import_id=$1',
      [r.related_id, r.id],
    );
    await m.query(
      `UPDATE invoices i SET status='VOIDED',balance_amount=0,voided_by=$2,voided_at=$3::date::timestamp AT TIME ZONE $4,
      void_reason=$5,state_version=state_version+1 FROM finance_ar_opening_items o WHERE o.invoice_id=i.id AND o.void_id=$1`,
      [r.id, reviewer, r.effective_date, b.timezone, r.reference],
    );
  } else {
    await m.query(
      `INSERT INTO finance_ar_opening_items(invoice_id,import_id,company_id,customer_id,reference,currency,invoice_date,due_date,cutoff,outstanding)
      SELECT public.finance_uuid_v4(),$1,$2,c.id,l.reference,$3,l."invoiceDate",l."dueDate",$4,l.amount
      FROM jsonb_to_recordset($5) AS l("customerCode" text,"customerId" uuid,reference text,"invoiceDate" date,"dueDate" date,amount numeric)
      JOIN customers c ON c.company_id=$2 AND c.id=l."customerId" AND upper(c.customer_no)=l."customerCode" AND c.deleted_at IS NULL`,
      [
        r.id,
        b.company_id,
        r.currency,
        r.effective_date,
        JSON.stringify(r.data.openingItems),
      ],
    );
    const inserted = await m.query(
      `WITH created AS (INSERT INTO invoices(id,company_id,insurer_company_id,customer_id,invoice_no,invoice_type,source_type,source_record_id,
      currency,gross_amount,total_amount,balance_amount,status,issued_at,created_by,issued_by,notes)
      SELECT o.invoice_id,o.company_id,o.company_id,o.customer_id,finance_fin01_number((finance_fin01_primary(o.company_id)).id,'INVOICE'),'OPENING','AR_OPENING',o.import_id,
      o.currency,o.outstanding,o.outstanding,o.outstanding,'ISSUED',now(),$2,$3,'Opening invoice '||o.reference||' dated '||o.invoice_date
      FROM finance_ar_opening_items o WHERE o.import_id=$1 ORDER BY o.customer_id,o.reference RETURNING id) SELECT id FROM created`,
      [r.id, r.maker_id, reviewer],
    );
    if (inserted.length !== r.data.openingItems!.length)
      conflict('The opening customer population changed during review.');
  }
  await m.query("UPDATE finance_ar_documents SET state='POSTED' WHERE id=$1", [
    r.id,
  ]);
}
