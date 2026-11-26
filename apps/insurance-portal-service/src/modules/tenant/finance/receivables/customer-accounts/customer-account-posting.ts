import type { EntityManager } from 'typeorm';
import { DecimalUtil } from '../../../../shared/finance/decimal.util';
import { financeConfigurationHash as hash } from '../../foundation/finance-configuration/finance-configuration.types';
import type { FinanceCommandService } from '../payment-transactions/finance-command.service';
import type { InvoiceBalanceService } from '../outstanding-balances/invoice-balance.service';
import { conflict, document, type ArDocument } from './customer-accounts.types';
const dec = DecimalUtil.value.bind(DecimalUtil);

export async function checkFunds(m: EntityManager, r: ArDocument) {
  const amount = dec(r.amount),
    k = r.kind;
  const [i] = r.invoice_id
    ? await m.query(
        "SELECT *,total_amount+ar_adjustment-paid_amount-written_off_amount raw FROM invoices WHERE id=$1 AND company_id=$2 AND status IN ('ISSUED','PARTIALLY_PAID','PAID','OVERPAID') FOR UPDATE",
        [r.invoice_id, r.company_id],
      )
    : [];
  if (r.invoice_id && !i)
    conflict('The source invoice is no longer open for adjustments.');
  if (k === 'ADVANCE') {
    const [receipt] = await m.query(
      "SELECT finance_ar_free_cash(id,NULL) available FROM receipts WHERE id=$1 AND company_id=$2 AND status IN ('POSTED','PARTIALLY_ALLOCATED') FOR UPDATE",
      [r.receipt_id, r.company_id],
    );
    if (
      !receipt ||
      dec(receipt.available)
        .plus(r.state === 'APPROVED' ? r.amount : 0)
        .lt(amount)
    )
      conflict('The receipt no longer has enough unreserved cash.');
  }
  if (k === 'CREDIT_NOTE' && !r.data.billingSourceId) {
    const [prior] = await m.query(
      `SELECT coalesce(sum(CASE d.kind WHEN 'DEBIT_NOTE' THEN d.amount ELSE -d.amount END),0) adjusted FROM finance_ar_documents d
      WHERE d.invoice_id=$1 AND d.id<>$2 AND d.kind IN ('DEBIT_NOTE','CREDIT_NOTE') AND NOT (d.data ? 'billingSourceId') AND d.state='POSTED'
      AND NOT EXISTS(SELECT 1 FROM finance_ar_documents x WHERE x.related_id=d.id AND x.kind='REVERSAL' AND x.state='POSTED')`,
      [r.invoice_id, r.id],
    );
    if (
      dec(i.total_amount)
        .plus(prior.adjusted)
        .minus(i.written_off_amount)
        .lt(amount)
    )
      conflict(
        'Total credits exceed the invoiced amount and posted debit notes.',
      );
  }
  if (
    k === 'ADVANCE_APPLICATION' ||
    k === 'CREDIT_APPLICATION' ||
    k === 'WRITE_OFF'
  ) {
    if (dec(i.balance_amount).lt(amount))
      conflict('The current invoice balance is insufficient.');
  }
  if (
    [
      'ADVANCE_RELEASE',
      'ADVANCE_APPLICATION',
      'CREDIT_APPLICATION',
      'CREDIT_REFUND',
    ].includes(k)
  ) {
    const src = await document(m, r.book_id, r.related_id);
    const [used] = await m.query(
      `SELECT coalesce(sum(amount),0) used,coalesce(sum(amount) FILTER(WHERE state='APPROVED'),0) reserved
      FROM finance_ar_documents d WHERE related_id=$1 AND id<>$2 AND state IN ('APPROVED','POSTED')
      AND NOT EXISTS(SELECT 1 FROM finance_ar_documents rev WHERE rev.related_id=d.id AND rev.kind='REVERSAL' AND rev.state='POSTED')`,
      [src.id, r.id],
    );
    if (dec(src.amount).minus(used.used).lt(amount))
      conflict(
        'Another application, refund or reversal has used this balance.',
      );
    if (src.kind === 'CREDIT_NOTE') {
      const [credit] = await m.query(
        'SELECT paid_amount+written_off_amount-total_amount-ar_adjustment available FROM invoices WHERE id=$1 FOR UPDATE',
        [src.invoice_id],
      );
      const [other] = await m.query(
        `SELECT coalesce(sum(d.amount),0) reserved FROM finance_ar_documents d JOIN finance_ar_documents n ON d.related_id=n.id
        WHERE n.invoice_id=$1 AND d.kind IN ('CREDIT_APPLICATION','CREDIT_REFUND') AND d.state='APPROVED' AND d.id<>$2`,
        [src.invoice_id, r.id],
      );
      if (dec(credit.available).minus(other.reserved).lt(amount))
        conflict(
          'The original invoice does not have sufficient unused credit.',
        );
    }
  }
  if (k === 'REVERSAL') {
    const original = await document(m, r.book_id, r.related_id);
    if (original.kind === 'ADVANCE_RELEASE') {
      const [cash] = await m.query(
        'SELECT finance_ar_free_cash(id,NULL) available FROM receipts WHERE id=$1 FOR UPDATE',
        [original.receipt_id],
      );
      if (
        dec(cash.available)
          .plus(r.state === 'APPROVED' ? r.amount : 0)
          .lt(r.amount)
      )
        conflict(
          'The released advance has already been allocated or refunded.',
        );
    }
    if (original.data.target) {
      const [later] = await m.query(
        "SELECT id FROM finance_ar_documents WHERE invoice_id=$1 AND state='POSTED' AND id<>$2 AND data ? 'target' AND sequence>$3 AND kind<>'REVERSAL' AND NOT EXISTS(SELECT 1 FROM finance_ar_documents x WHERE x.related_id=finance_ar_documents.id AND x.kind='REVERSAL' AND x.state='POSTED')",
        [original.invoice_id, original.id, original.sequence],
      );
      if (later)
        conflict('Reverse later loss assessments and write-offs first.');
    }
    const [used] = await m.query(
      `SELECT id FROM finance_ar_documents d WHERE related_id=$1 AND id<>$2 AND state IN ('APPROVED','POSTED') AND
      NOT EXISTS(SELECT 1 FROM finance_ar_documents rev WHERE rev.related_id=d.id AND rev.kind='REVERSAL' AND rev.state='POSTED')`,
      [r.related_id, r.id],
    );
    if (used) conflict('Reverse the dependent application before its source.');
  }
}

export async function applyAr(
  m: EntityManager,
  r: ArDocument,
  journal: string | null,
  balance: InvoiceBalanceService,
  commands: FinanceCommandService,
) {
  if (r.state === 'POSTED' && r.journal_id === journal) return;
  if (r.state !== 'APPROVED')
    conflict(
      'This customer document does not have an active independent approval.',
    );
  await checkFunds(m, r);
  const [period] = await m.query(
    "SELECT id FROM finance_foundation_periods WHERE book_id=$1 AND mode='LIVE' AND state='OPEN' AND starts_on<=$2 AND ends_before>$2 AND coalesce(to_jsonb(finance_foundation_periods)->>'period_kind','REGULAR')='REGULAR' FOR SHARE",
    [r.book_id, r.effective_date],
  );
  if (!period)
    conflict('The effective date requires an open accounting period.');
  await m.query(
    "UPDATE finance_ar_documents SET state='POSTED',journal_id=$2 WHERE id=$1",
    [r.id, journal],
  );
  await m.query("SELECT set_config('finance.ar_effective_date',$1,true)", [
    r.effective_date,
  ]);
  const move = async (id: string, n: string, writeoff = false) => {
    await m.query(
      'INSERT INTO finance_ar_movements(document_id,invoice_id,amount) VALUES($1,$2,$3)',
      [r.id, id, n],
    );
    if (writeoff)
      await m.query(
        'UPDATE invoices SET written_off_amount=written_off_amount-$2::numeric WHERE id=$1',
        [id, n],
      );
    else
      await m.query(
        'UPDATE invoices SET ar_adjustment=ar_adjustment+$2::numeric,balance_amount=greatest(0,total_amount+ar_adjustment+$2::numeric-paid_amount-written_off_amount) WHERE id=$1',
        [id, n],
      );
    await balance.recalculate(m, id);
    await commands.publishInvoiceBalanceProjections(m, id, r.id, r.maker_id);
  };
  const negative = dec(r.amount).neg().toFixed();
  if (
    !r.data.billingSourceId &&
    (r.kind === 'DEBIT_NOTE' || r.kind === 'CREDIT_NOTE')
  )
    await move(r.invoice_id, r.kind === 'DEBIT_NOTE' ? r.amount : negative);
  if (r.kind === 'CREDIT_REFUND') await move(r.invoice_id, r.amount);
  if (r.kind === 'WRITE_OFF') await move(r.invoice_id, negative, true);
  if (r.kind === 'CREDIT_APPLICATION') {
    const origin = await document(m, r.book_id, r.related_id);
    await move(origin.invoice_id, r.amount);
    await move(r.invoice_id, negative);
  }
  if (r.kind === 'ADVANCE_APPLICATION') {
    await commands.allocateWithManager(
      m,
      { id: r.maker_id, companyId: r.company_id },
      {
        receiptId: r.receipt_id,
        invoiceId: r.invoice_id,
        amount: dec(r.amount),
        idempotencyKey: 'ar:' + r.id,
        arDocumentId: r.id,
      },
    );
  }
  if (r.kind === 'REVERSAL') {
    const origin = await document(m, r.book_id, r.related_id);
    if (origin.kind === 'ADVANCE_APPLICATION') {
      const updated = await m.query(
        `WITH reversed AS (UPDATE receipt_allocations SET status='REVERSED',reversed_at=$3::date::timestamp AT TIME ZONE (finance_fin01_primary($4)).timezone,reversed_by=$2,reversal_reason=$5
        WHERE ar_document_id=$1 AND status='ACTIVE' RETURNING invoice_id) SELECT invoice_id FROM reversed`,
        [origin.id, r.maker_id, r.effective_date, r.company_id, r.reference],
      );
      if (!updated.length)
        conflict('The original receipt application is unavailable.');
      await commands.recalculateAllocationBalances(
        m,
        origin.invoice_id,
        origin.receipt_id,
        r.id,
        r.maker_id,
      );
    }
    const moves = await m.query(
      'SELECT invoice_id,(-amount)::text delta FROM finance_ar_movements WHERE document_id=$1 ORDER BY invoice_id',
      [origin.id],
    );
    for (const v of moves)
      await move(v.invoice_id, v.delta, origin.kind === 'WRITE_OFF');
  }
  if (
    r.data.memo &&
    ['DEBIT_NOTE', 'CREDIT_NOTE', 'REVERSAL'].includes(r.kind)
  ) {
    const payload = {
      source: 'CUSTOMER_NOTE',
      id: r.id,
      bookId: r.book_id,
      invoiceId: r.invoice_id,
      kind: r.kind,
      amount: r.amount,
      tax: r.data.tax ?? '0',
      currency: r.currency,
      date: r.effective_date,
      evidence: r.data.evidence,
      relatedId: r.related_id,
    };
    await m.query(
      'INSERT INTO finance_ar_premium_memos(id,book_id,invoice_id,accounting_date,subject_hash,payload) VALUES($1,$2,$3,$4,$5,$6)',
      [r.id, r.book_id, r.invoice_id, r.effective_date, hash(payload), payload],
    );
  }
}
