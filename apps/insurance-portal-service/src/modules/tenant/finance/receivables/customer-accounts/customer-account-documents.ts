import type { EntityManager } from 'typeorm';
import { DecimalUtil } from '../../../../shared/finance/decimal.util';
import {
  bookChart,
  ownedEvidence,
  usesInsuranceMeasurement,
  type ActivePostingBook,
} from '../../accounting/general-ledger/finance-book-request';
import { voucherLines } from '../../accounting/general-ledger/finance-gl-voucher.service';
import {
  fromMinor,
  moneyMinor,
  type VoucherLine,
} from '../../accounting/general-ledger/finance-gl-program';
import { accountReport, matchStatement } from './customer-account-reports';
import {
  conflict,
  day,
  document,
  invalid,
  kinds,
  policy,
  text,
  uuid,
  type ArDocument,
  type ArInput,
} from './customer-accounts.types';

const roleTypes: Record<string, string[]> = {
  ar: ['ASSET'],
  income: ['INCOME'],
  advance: ['LIABILITY'],
  tax: ['LIABILITY'],
  bank: ['ASSET'],
  expense: ['EXPENSE'],
  allowance: ['ASSET', 'CONTRA_ASSET'],
  premiumCash: ['LIABILITY', 'ASSET'],
};
import {
  prepareCustomerOpening,
  openingForCorrection,
} from './customer-opening-items';

export async function prepareAr(
  m: EntityManager,
  b: ActivePostingBook,
  v: ArInput,
) {
  if (!v || !kinds.includes(v.kind))
    invalid('Choose a customer document type.');
  const date = day(v.date),
    currency = text(v.currency, 'currency', 3),
    scale = Math.min(4, b.context.currencyScales[currency]);
  if (!Number.isInteger(scale)) invalid('Select an enabled book currency.');
  const k = v.kind,
    reference = text(v.reference, 'reference'),
    requestKey = text(v.requestKey, 'request key', 180);
  const data: ArDocument['data'] = {
    kind: k,
    date,
    currency,
    reference,
    requestKey,
    lines: [],
  };
  const amountOf = (s: unknown) =>
    fromMinor(
      moneyMinor(
        typeof s === 'string' ? s : invalid('Enter a valid amount.'),
        scale,
      ),
      scale,
    );
  let amount = amountOf(
    k === 'RECONCILIATION' && typeof v.amount === 'string'
      ? v.amount.replace(/^-/, '')
      : (v.amount ?? '0'),
  );
  const requiredCustomer = ![
    'POLICY',
    'CATEGORY',
    'OPENING_IMPORT',
    'OPENING_VOID',
  ].includes(k);
  const customer = requiredCustomer ? uuid(v.customerId, 'customer') : null;
  if (
    customer &&
    !(
      await m.query(
        'SELECT 1 FROM customers WHERE id=$1 AND company_id=$2 AND deleted_at IS NULL FOR SHARE',
        [customer, b.company_id],
      )
    ).length
  )
    invalid('Select a customer of this company.');
  if (v.evidence || k !== 'CATEGORY') {
    await ownedEvidence(m, b, v.evidence);
    data.evidence = v.evidence;
  }
  const chart = await bookChart(m, b);
  let invoiceId: string | null = null,
    receiptId: string | null = null,
    relatedId: string | null = null;
  const invoice = async (id: unknown) => {
    invoiceId = uuid(id, 'issued invoice');
    const [i] = await m.query(
      `SELECT i.*,coalesce(i.issued_at,i.posted_at,i.created_at) AT TIME ZONE $5 issued_local
      FROM invoices i WHERE id=$1 AND company_id=$2 AND customer_id=$3 AND currency=$4 AND deleted_at IS NULL AND status IN ('ISSUED','PARTIALLY_PAID','PAID','OVERPAID') FOR UPDATE`,
      [invoiceId, b.company_id, customer, currency, b.timezone],
    );
    if (
      !i ||
      !(
        await m.query('SELECT $1::timestamp::date<=$2::date ok', [
          i.issued_local,
          date,
        ])
      )[0].ok
    )
      conflict('Select an issued invoice for this debtor, currency and date.');
    return i;
  };
  const related = async (id: unknown, kind?: string) => {
    const r = await document(m, b.book_id, uuid(id, 'source document'));
    if (
      r.customer_id !== customer ||
      r.currency !== currency ||
      r.effective_date > date ||
      r.state !== 'POSTED' ||
      (kind && r.kind !== kind)
    )
      conflict(
        'Select a posted source for the same customer and currency on or before this date.',
      );
    relatedId = r.id;
    return r;
  };
  if (k === 'OPENING_IMPORT') {
    const checked = await prepareCustomerOpening(m, b, v);
    data.openingItems = checked.items;
    data.remainingAfterImport = checked.remaining;
    data.certificateId = checked.certificateId;
    data.controlAccount = checked.account;
    amount = checked.total;
  } else if (k === 'OPENING_VOID') {
    const original = await openingForCorrection(m, b, v);
    relatedId = original.id;
    data.relatedId = original.id;
    amount = original.amount;
  } else if (k === 'CATEGORY') {
    data.enabled = v.enabled !== false;
  } else if (k === 'POLICY') {
    for (const key of Object.keys(roleTypes).filter(
      (x) => x !== 'premiumCash' || usesInsuranceMeasurement(b),
    )) {
      const role = chart.roles.find((r) => r.code === v.roles?.[key]);
      const account = chart.accounts.find((a) => a.code === role?.accountCode);
      if (!account?.posting || !roleTypes[key].includes(account.type))
        invalid('Choose a posting account for ' + key + '.');
      (data.roles ??= {})[key] = role!.code;
    }
    const billing = b.context.allowedComponents.filter(
      (c) =>
        c.origin === 'INSURANCE_PORTAL_FINANCE' &&
        c.sourceEventType === 'INVOICE_ISSUED' &&
        c.owner === 'FINANCE' &&
        c.effect === 'ORDINARY',
    );
    if (
      !billing.some(
        (c) =>
          c.debitRoles.includes(data.roles!.ar) &&
          c.creditRoles.includes(data.roles!.income),
      )
    )
      invalid(
        'Use the receivable and income roles approved for invoice billing in this book.',
      );
    if (
      new Set(
        Object.values(data.roles!).map(
          (code) => chart.roles.find((r) => r.code === code)!.accountCode,
        ),
      ).size !== Object.keys(data.roles!).length
    )
      invalid('Choose distinct customer accounting control accounts.');
    if (
      !Array.isArray(v.lossRates) ||
      v.lossRates.length !== 5 ||
      v.lossRates.some(
        (s, i) =>
          typeof s !== 'string' ||
          !/^\d{1,3}(\.\d{1,4})?$/.test(s) ||
          Number(s) > 100 ||
          (i > 0 && Number(s) < Number(v.lossRates![i - 1])),
      )
    )
      invalid(
        'Enter five increasing or equal loss percentages from zero to one hundred.',
      );
    if (
      !Array.isArray(v.reminderDays) ||
      v.reminderDays.length > 10 ||
      v.reminderDays.some(
        (n, i) =>
          !Number.isInteger(n) ||
          n < 0 ||
          n > 365 ||
          (i > 0 && n <= v.reminderDays![i - 1]),
      )
    )
      invalid('Enter unique increasing reminder days after the due date.');
    if (v.requireProfile !== undefined && typeof v.requireProfile !== 'boolean')
      invalid('Choose the credit policy for customers without a profile.');
    data.requireProfile = v.requireProfile !== false;
    if (
      usesInsuranceMeasurement(b) &&
      !b.context.allowedComponents.some(
        (c) =>
          c.origin === 'INSURANCE_PORTAL_FINANCE' &&
          c.sourceEventType === 'PREMIUM_RECEIPT_POSTED' &&
          c.creditRoles.includes(data.roles!.premiumCash),
      )
    )
      invalid('Choose the reviewed premium receipt control role.');
    data.lossRates = v.lossRates;
    data.reminderDays = v.reminderDays;
  } else if (k === 'PROFILE') {
    const category = await document(
      m,
      b.book_id,
      uuid(v.categoryId, 'customer category'),
    );
    if (
      category.kind !== 'CATEGORY' ||
      category.state !== 'APPROVED' ||
      category.effective_date > date ||
      !category.data.enabled
    )
      invalid('Choose an approved effective category.');
    const [latest] = await m.query(
      "SELECT id,data FROM finance_ar_documents WHERE book_id=$1 AND kind='CATEGORY' AND upper(reference)=upper($2) AND state='APPROVED' AND effective_date<=$3 ORDER BY effective_date DESC,sequence DESC LIMIT 1",
      [b.book_id, category.reference, date],
    );
    if (!latest || !latest.data.enabled)
      invalid('This category is disabled on the profile date.');
    data.categoryId = latest.id;
    data.termCode = text(v.termCode, 'payment term');
    const terms = (
      b.controls as unknown as {
        paymentTerms: { party: string; code: string }[];
      }
    ).paymentTerms;
    if (!terms.some((t) => t.party === 'CUSTOMER' && t.code === data.termCode))
      invalid('Choose a customer payment term enabled in FIN-01.');
  } else if (k === 'PAYER_MANDATE') {
    data.payerId = uuid(v.payerId, 'payer');
    if (
      data.payerId === customer ||
      typeof v.enabled !== 'boolean' ||
      !(
        await m.query(
          'SELECT id FROM customers WHERE company_id=$1 AND id=$2 AND deleted_at IS NULL',
          [b.company_id, data.payerId],
        )
      ).length
    )
      invalid(
        'Choose a different payer registered with this company and a mandate decision.',
      );
    data.enabled = v.enabled;
  } else if (k === 'RECONCILIATION') {
    const report = await accountReport(
      m,
      b,
      day(v.from),
      date,
      currency,
      customer!,
    );
    if (!matchStatement(v, report))
      conflict(
        'The external opening, dated movements or closing balance differs from the customer statement.',
      );
    data.from = v.from;
    data.opening = v.opening;
    data.statementLines = v.statementLines;
    data.amount = v.amount;
    data.signature = report.signature;
  } else if (k === 'REVERSAL') {
    const original = await related(v.relatedId);
    if (
      ![
        'DEBIT_NOTE',
        'CREDIT_NOTE',
        'IMPAIRMENT',
        'WRITE_OFF',
        'CREDIT_APPLICATION',
        'ADVANCE',
        'ADVANCE_APPLICATION',
        'ADVANCE_RELEASE',
      ].includes(original.kind)
    )
      invalid(
        'Use an advance release or the signed refund workflow for this source.',
      );
    invoiceId = original.invoice_id;
    receiptId = original.receipt_id;
    amount = original.amount;
    data.memo = original.data.memo;
    data.originalId = original.id;
    if (original.data.target)
      data.target = DecimalUtil.value(original.data.target).neg().toFixed();
    if (
      (
        await m.query(
          "SELECT id FROM finance_ar_documents WHERE related_id=$1 AND state NOT IN ('REJECTED','CANCELLED') AND (kind='REVERSAL' OR NOT EXISTS(SELECT 1 FROM finance_ar_documents r WHERE r.related_id=finance_ar_documents.id AND r.kind='REVERSAL' AND r.state='POSTED'))",
          [original.id],
        )
      ).length
    )
      conflict('Resolve linked applications or the existing reversal first.');
  } else {
    const p = await policy(m, b.book_id, currency, date),
      roles = p.data.roles!;
    data.policyId = p.id;
    const dimensions = v.dimensions ?? {};
    const line = (key: string, dr: string, cr: string) =>
      data.lines.push({ role: roles[key], debit: dr, credit: cr, dimensions });
    const pair = (dr: string, cr: string, n = amount) => {
      line(dr, n, '0');
      line(cr, '0', n);
    };
    if (k === 'DEBIT_NOTE' || k === 'CREDIT_NOTE') {
      const i = await invoice(v.invoiceId);
      const tax = amountOf(v.tax ?? '0'),
        net = DecimalUtil.value(amount).minus(tax);
      if (net.isNegative())
        invalid('The tax component exceeds the gross note.');
      data.tax = tax;
      if (v.billingSourceId) {
        data.billingSourceId = uuid(
          v.billingSourceId,
          'originating billing transaction',
        );
        const [source] =
          k === 'DEBIT_NOTE'
            ? await m.query(
                "SELECT id FROM invoices WHERE id=$1 AND company_id=$2 AND customer_id=$3 AND currency=$4 AND total_amount=$5 AND coalesce(issued_at,posted_at) IS NOT NULL AND status<>'VOIDED' AND (endorsement_id IS NOT NULL OR source_type IN ('ENDORSEMENT','POLICY_ENDORSEMENT')) AND policy_id=$6 AND (coalesce(issued_at,posted_at) AT TIME ZONE $7)::date<=$8 FOR SHARE",
                [
                  data.billingSourceId,
                  b.company_id,
                  customer,
                  currency,
                  amount,
                  i.policy_id,
                  b.timezone,
                  date,
                ],
              )
            : await m.query(
                "SELECT id FROM finance_refunds WHERE id=$1 AND company_id=$2 AND invoice_id=$3 AND currency_code=$4 AND amount=$5 AND source_record_id IS NOT NULL AND status IN ('APPROVED','PAID') AND (approved_at AT TIME ZONE $6)::date<=$7 FOR SHARE",
                [
                  data.billingSourceId,
                  b.company_id,
                  i.id,
                  currency,
                  amount,
                  b.timezone,
                  date,
                ],
              );
        if (!source)
          conflict(
            'The originating premium adjustment must match the debtor, policy, amount, currency and accounting date.',
          );
        return { data, amount, customer, invoiceId, receiptId, relatedId };
      }
      if (
        i.source_record_id &&
        (reference.toLowerCase() === i.source_record_id ||
          reference.toUpperCase() === i.invoice_no.toUpperCase())
      )
        conflict('The underlying billing transaction already has an invoice.');
      data.memo = i.invoice_type === 'PREMIUM' && usesInsuranceMeasurement(b);
      if (data.memo) {
        if (
          !(
            await m.query(
              "SELECT id FROM finance_gl_premium_memos WHERE book_id=$1 AND invoice_id=$2 AND event_type='ISSUED'",
              [b.book_id, i.id],
            )
          ).length
        )
          conflict('Record the originating premium billing memorandum first.');
      } else {
        const debit = k === 'DEBIT_NOTE';
        line('ar', debit ? amount : '0', debit ? '0' : amount);
        if (net.gt(0))
          line(
            'income',
            debit ? '0' : net.toFixed(),
            debit ? net.toFixed() : '0',
          );
        if (DecimalUtil.value(tax).gt(0))
          line('tax', debit ? '0' : tax, debit ? tax : '0');
      }
    } else if (k === 'ADVANCE') {
      receiptId = uuid(v.receiptId, 'unallocated receipt');
      const [r] = await m.query(
        "SELECT *,finance_ar_free_cash(id,NULL) available FROM receipts WHERE id=$1 AND company_id=$2 AND coalesce(payer_customer_id,customer_id)=$3 AND currency=$4 AND status IN ('POSTED','PARTIALLY_ALLOCATED') AND (coalesce(posted_at,received_at) AT TIME ZONE $6)::date<=$5 FOR UPDATE",
        [receiptId, b.company_id, customer, currency, date, b.timezone],
      );
      if (!r || DecimalUtil.value(r.available).lt(amount))
        conflict('Choose available unallocated cash for this debtor.');
      pair('ar', 'advance');
    } else if (k === 'ADVANCE_APPLICATION' || k === 'ADVANCE_RELEASE') {
      const original = await related(v.relatedId, 'ADVANCE');
      receiptId = original.receipt_id;
      if (k === 'ADVANCE_APPLICATION') {
        const i = await invoice(v.invoiceId);
        if (DecimalUtil.value(i.balance_amount).lt(amount))
          conflict('The application exceeds the open invoice.');
        pair(
          'advance',
          i.invoice_type === 'PREMIUM' && usesInsuranceMeasurement(b)
            ? 'premiumCash'
            : 'ar',
        );
      } else pair('advance', 'ar');
    } else if (k === 'CREDIT_APPLICATION' || k === 'CREDIT_REFUND') {
      const credit = await related(v.relatedId, 'CREDIT_NOTE');
      if (credit.data.billingSourceId)
        conflict(
          'Settle the originating policy refund to pay this linked credit note.',
        );
      if (k === 'CREDIT_APPLICATION') {
        const i = await invoice(v.invoiceId);
        if (
          i.id === credit.invoice_id ||
          DecimalUtil.value(i.balance_amount).lt(amount)
        )
          conflict('Choose another open invoice with sufficient balance.');
        const premium =
          i.invoice_type === 'PREMIUM' && usesInsuranceMeasurement(b);
        if (!!credit.data.memo !== premium)
          conflict(
            'Apply credits within the same premium measurement or trade control population.',
          );
      } else {
        invoiceId = credit.invoice_id;
        const role = chart.roles.find((x) => x.code === roles.bank)!;
        if (
          !b.controls.paymentMethods.some(
            (x) => x.accountCode === role.accountCode,
          )
        )
          invalid('Use an approved settlement account for customer refunds.');
        data.bankAccount = role.accountCode!;
        pair(credit.data.memo ? 'premiumCash' : 'ar', 'bank');
      }
    } else if (k === 'WRITE_OFF') {
      const i = await invoice(v.invoiceId);
      if (i.invoice_type === 'PREMIUM' && usesInsuranceMeasurement(b))
        conflict('Premium derecognition requires an insurance measurement.');
      if (DecimalUtil.value(i.balance_amount).lt(amount))
        conflict('Write-off exceeds the remaining invoice balance.');
      const [loss] = await m.query(
        "SELECT coalesce(sum((data->>'target')::numeric),0) balance FROM finance_ar_documents WHERE invoice_id=$1 AND state='POSTED'",
        [i.id],
      );
      const covered = DecimalUtil.value(loss.balance).gt(amount)
        ? DecimalUtil.value(amount)
        : DecimalUtil.value(loss.balance);
      const residual = DecimalUtil.value(amount).minus(covered);
      if (covered.gt(0)) line('allowance', covered.toFixed(), '0');
      if (residual.gt(0)) line('expense', residual.toFixed(), '0');
      line('ar', '0', amount);
      data.target = covered.neg().toFixed();
    } else if (k === 'IMPAIRMENT') {
      const i = await invoice(v.invoiceId);
      if (i.invoice_type === 'PREMIUM' && usesInsuranceMeasurement(b))
        conflict(
          'This premium belongs to the insurance measurement population.',
        );
      const [loss] = await m.query(
        `SELECT greatest(coalesce(sum(a.invoice_delta),0),0) exposure,
        ($3::date-i.due_date) overdue FROM invoices i LEFT JOIN finance_ar_activity($1,$2) a ON a.invoice_id=i.id AND a.day<=$3
        WHERE i.id=$4 GROUP BY i.id`,
        [b.company_id, b.timezone, date, i.id],
      );
      if (loss.overdue === null)
        conflict('Set the invoice due date before evaluating impairment.');
      const band = [0, 30, 60, 90].filter((n) => loss.overdue > n).length;
      const target = DecimalUtil.value(loss.exposure)
        .mul(p.data.lossRates![band])
        .div(100)
        .toDecimalPlaces(scale);
      const [later] = await m.query(
        "SELECT id FROM finance_ar_documents WHERE invoice_id=$1 AND state='POSTED' AND effective_date>$2 AND data ? 'target'",
        [i.id, date],
      );
      if (later)
        conflict(
          'Use an assessment date on or after the latest posted loss movement.',
        );
      const [previous] = await m.query(
        "SELECT coalesce(sum((d.data->>'target')::numeric),0) balance FROM finance_ar_documents d WHERE invoice_id=$1 AND state='POSTED'",
        [i.id],
      );
      const delta = target.minus(previous.balance);
      data.target = delta.toFixed();
      amount = delta.abs().toFixed();
      if (delta.isZero())
        conflict(
          'The recorded allowance already equals the calculated allowance.',
        );
      pair(
        delta.gt(0) ? 'expense' : 'allowance',
        delta.gt(0) ? 'allowance' : 'expense',
      );
    }
    if (DecimalUtil.value(amount).lte(0))
      invalid('Enter a positive transaction amount.');
    if (data.lines.length)
      await voucherLines(
        m,
        b,
        'MANUAL',
        { date, currency, lines: data.lines },
        chart,
      );
  }
  return { data, amount, customer, invoiceId, receiptId, relatedId };
}
