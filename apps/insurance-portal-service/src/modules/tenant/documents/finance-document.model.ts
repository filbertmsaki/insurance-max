/**
 * Tax invoice and receipt on the shared branded document. Amounts are the
 * stored invoice and receipt values; nothing is recalculated except splitting
 * a single tax-inclusive premium line into price and tax for display.
 */
import {
  amountInWords,
  compact,
  compactFields,
  formatDate,
  formatDateTime,
  formatMoney,
  humanize,
  issuerOf,
  money,
  paymentInstructionFields,
  roundMoney,
  text,
  toNumber,
  type BrandedDocument,
  type DocBlock,
  type DocField,
  type DocMoneyLine,
  type DocSection,
  type DocTone,
} from './branded-document';

type Rec = Record<string, any>;

export interface InvoiceDocumentSource {
  invoice: Rec;
  /** Insurer company record: letterhead and payment details. */
  issuer: Rec | null;
  logo: Uint8Array | null;
  /** Latest active payment reference control number, if any. */
  controlNumber?: string | null;
  now?: Date;
}

export interface ReceiptDocumentSource {
  receipt: Rec;
  /** Invoice the receipt pays, with its quotation and policy loaded. */
  invoice: Rec | null;
  issuer: Rec | null;
  logo: Uint8Array | null;
  transactionNo?: string | null;
  now?: Date;
}

/* ------------------------------------------------------------------------ */
/* Shared pieces                                                             */
/* ------------------------------------------------------------------------ */

function customerName(c: Rec | null | undefined) {
  if (!c) return '';
  return (
    text(c.company_name) ||
    text(c.display_name) ||
    compact([c.first_name, c.middle_name, c.last_name]).join(' ')
  );
}

const ID_TYPES: Record<string, string> = {
  nida_no: 'NIDA No.',
  passport_no: 'Passport No.',
  driving_license_no: 'Driving Licence No.',
  voter_no: "Voter's ID No.",
  zanid_no: 'ZAN ID No.',
};

function identification(c: Rec): [string, unknown] {
  for (const [key, label] of Object.entries(ID_TYPES)) {
    if (text(c[key])) return [label, c[key]];
  }
  return ['ID No.', c.id_number];
}

/** Customer / policyholder block, same fields on every finance document. */
export function customerSection(
  customer: Rec | null | undefined,
  title = 'Customer Details',
  payerName?: string,
): DocSection | null {
  const c: Rec = customer ?? {};
  const corporate =
    /corporate|company/i.test(text(c.customer_type)) || !!text(c.company_name);
  const fields = compactFields([
    [corporate ? 'Company Name' : 'Full Name', customerName(c) || payerName],
    ['Paid By', payerName && payerName !== customerName(c) ? payerName : ''],
    ['Customer No.', c.customer_no],
    ['Customer Type', humanize(c.customer_type)],
    identification(c),
    ['TIN', c.tin],
    ['VRN', c.vrn],
    ['Telephone', c.phone],
    ['Email', c.email],
    [
      'Postal Address',
      text(c.postal_address) && `P.O. Box ${text(c.postal_address)}`,
    ],
    [
      'Physical Address',
      compact([c.street, c.ward, c.district, c.region]).join(', '),
    ],
  ]);
  return fields.length
    ? { title, blocks: [{ kind: 'fields', fields, columns: 2 }] }
    : null;
}

function invoiceTone(status: string): DocTone {
  if (status === 'PAID') return 'success';
  if (status === 'PARTIALLY_PAID' || status === 'ISSUED' || status === 'POSTED')
    return 'warning';
  if (status === 'VOID' || status === 'CANCELLED') return 'danger';
  return 'neutral';
}

function invoiceWatermark(status: string) {
  if (status === 'DRAFT') return 'DRAFT';
  if (status === 'VOID' || status === 'VOIDED') return 'VOID';
  if (status === 'CANCELLED') return 'CANCELLED';
  return '';
}

function amount(value: unknown) {
  return roundMoney(toNumber(value) ?? 0);
}

function nonZero(value: number) {
  return Math.abs(value) >= 0.005;
}

function percent(tax: number, base: number) {
  if (!(base > 0) || !nonZero(tax)) return '';
  return `${Number(((tax / base) * 100).toFixed(2))}%`;
}

/* ------------------------------------------------------------------------ */
/* Tax invoice                                                               */
/* ------------------------------------------------------------------------ */

export function buildInvoiceDocument(
  src: InvoiceDocumentSource,
): BrandedDocument {
  const inv = src.invoice;
  const currency = text(inv.currency) || 'TZS';
  const status = text(inv.status).toUpperCase();
  const gross = amount(inv.gross_amount);
  const discount = amount(inv.discount_amount);
  const charges = amount(inv.charges_amount);
  const tax = amount(inv.tax_amount);
  const total = amount(inv.total_amount);
  const paid = amount(inv.paid_amount);
  const balance = amount(inv.balance_amount);
  const net = roundMoney(total - tax);
  const taxRate = percent(tax, net);

  const items: Rec[] = [...(inv.items ?? [])].sort((a, b) =>
    String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')),
  );
  // A single stored line carries the whole tax-inclusive premium; show its
  // price before tax and the invoice tax beside it.
  const single = items.length === 1;
  const rows = items.map((item) => {
    const qty = toNumber(item.quantity) ?? 1;
    const lineTotal = amount(item.total_amount);
    const lineTax = single ? tax : 0;
    const unit = single
      ? roundMoney((lineTotal - lineTax) / (qty || 1))
      : amount(item.unit_amount);
    return [
      compact([
        item.item_name,
        item.description !== item.item_name && item.description,
      ]).join('\n'),
      Number(qty.toFixed(2)).toString(),
      formatMoney(unit),
      single ? taxRate : '',
      single && nonZero(lineTax) ? formatMoney(lineTax) : '',
      formatMoney(lineTotal),
    ];
  });
  const showTaxColumns = rows.some((r) => r[3] || r[4]);

  const quotationNo = text(inv.quotation?.quotation_no);
  const policyNo = text(inv.policy?.policy_no);

  const totals: DocMoneyLine[] = [];
  if (nonZero(gross) && (nonZero(discount) || nonZero(charges))) {
    totals.push({
      label: 'Premium before discount',
      amount: formatMoney(gross),
    });
  }
  if (nonZero(discount))
    totals.push({
      label: 'Less: Discount',
      amount: `(${formatMoney(discount)})`,
    });
  if (nonZero(charges))
    totals.push({ label: 'Other charges', amount: formatMoney(charges) });
  totals.push({ label: 'Subtotal (excluding tax)', amount: formatMoney(net) });
  if (nonZero(tax))
    totals.push({
      label: compact(['VAT', taxRate && `(${taxRate})`]).join(' '),
      amount: formatMoney(tax),
    });

  const after: DocMoneyLine[] = [];
  if (nonZero(paid))
    after.push({ label: 'Amount paid', amount: formatMoney(paid) });
  after.push({
    label: 'Balance due',
    amount: money(currency, balance),
    bold: true,
  });

  const sections: DocSection[] = [];
  const customer = customerSection(inv.customer, 'Bill To');
  if (customer) sections.push(customer);
  sections.push({
    title: 'Invoice Items',
    blocks: [
      {
        kind: 'table',
        columns: [
          { header: 'Description', width: 3.2 },
          { header: 'Qty', width: 0.6, align: 'right' },
          { header: `Unit Price (${currency})`, width: 1.4, align: 'right' },
          ...(showTaxColumns
            ? [
                { header: 'Tax Rate', width: 0.8, align: 'right' as const },
                {
                  header: `Tax (${currency})`,
                  width: 1.2,
                  align: 'right' as const,
                },
              ]
            : []),
          { header: `Line Total (${currency})`, width: 1.5, align: 'right' },
        ],
        rows: rows.map((r) => (showTaxColumns ? r : [r[0], r[1], r[2], r[5]])),
      },
      {
        kind: 'premium',
        currency,
        lines: totals,
        totalLabel: 'TOTAL',
        total: money(currency, total),
        words: amountInWords(total, currency),
        after,
      },
    ],
  });

  const payment = paymentInstructionFields(src.issuer, src.controlNumber);
  const blocks: DocBlock[] = [];
  if (payment.length)
    blocks.push({ kind: 'fields', fields: payment, columns: 2 });
  blocks.push({
    kind: 'paragraph',
    text: `Please quote invoice number ${text(inv.invoice_no)}${src.controlNumber ? ` or control number ${src.controlNumber}` : ''} when paying.${inv.due_date ? ` Payment is due by ${formatDate(inv.due_date)}.` : ''}`,
  });
  if (text(inv.notes))
    blocks.push({ kind: 'paragraph', text: text(inv.notes) });
  sections.push({ title: 'Payment Instructions', blocks });

  sections.push({
    title: 'Authorisation',
    blocks: [
      {
        kind: 'signatures',
        signatories: [
          {
            role: 'Authorised Officer',
            name: userName(inv.issuer ?? inv.poster ?? inv.creator),
          },
        ],
        stamp: true,
      },
    ],
  });

  const issued = inv.issued_at ?? inv.posted_at ?? inv.created_at;
  const watermark = invoiceWatermark(status);
  return {
    docType: 'TAX_INVOICE',
    title: 'TAX INVOICE',
    subtitle: quotationNo
      ? `Insurance premium for quotation ${quotationNo}`
      : policyNo
        ? `Insurance premium for policy ${policyNo}`
        : 'Insurance premium',
    number: text(inv.invoice_no),
    ...issuerOf(src.issuer, src.logo),
    reference: compactFields([
      ['Invoice No.', inv.invoice_no],
      ['Invoice Date', formatDate(issued)],
      ['Due Date', formatDate(inv.due_date)],
      ['Quotation No.', quotationNo],
      ['Policy No.', policyNo],
      ['Branch', inv.branch?.name],
      ['Issued By', userName(inv.issuer ?? inv.poster ?? inv.creator)],
      ['Control No.', src.controlNumber],
    ]),
    badge: status
      ? { text: humanize(status).toUpperCase(), tone: invoiceTone(status) }
      : undefined,
    sections,
    watermark,
    generatedAt: formatDateTime(src.now ?? new Date()),
    terms:
      'This tax invoice is payable in full by the due date. Cover is subject to receipt of the premium.',
  };
}

/* ------------------------------------------------------------------------ */
/* Receipt                                                                   */
/* ------------------------------------------------------------------------ */

export function buildReceiptDocument(
  src: ReceiptDocumentSource,
): BrandedDocument {
  const rc = src.receipt;
  const inv = src.invoice;
  const currency = text(rc.currency) || text(inv?.currency) || 'TZS';
  const received = amount(rc.amount);
  const status = text(rc.status).toUpperCase();
  const reversed = status === 'REVERSED' || !!rc.reversed_at;
  const balance = inv ? amount(inv.balance_amount) : null;
  const paidInFull = !reversed && balance !== null && !nonZero(balance);

  const details: DocField[] = compactFields([
    ['Amount Received', money(currency, received)],
    ['Amount in Words', amountInWords(received, currency)],
    ['Payment Method', humanize(rc.payment_method)],
    ['Payment Date', formatDateTime(rc.received_at ?? rc.created_at)],
    ['Transaction No.', src.transactionNo],
    ['Payment Reference', rc.payment_reference],
    [
      'Provider Reference',
      rc.provider_reference !== rc.payment_reference
        ? rc.provider_reference
        : '',
    ],
    ['Allocated to Invoice', money(currency, amount(rc.allocated_amount))],
    [
      'Unallocated',
      nonZero(amount(rc.unallocated_amount))
        ? money(currency, amount(rc.unallocated_amount))
        : '',
    ],
    ['Invoice Total', inv ? money(currency, amount(inv.total_amount)) : ''],
    [
      'Balance Remaining',
      balance !== null && !paidInFull ? money(currency, balance) : '',
    ],
  ]);

  const sections: DocSection[] = [];
  const customer = customerSection(
    rc.customer,
    'Received From',
    text(rc.payer_name),
  );
  if (customer) sections.push(customer);
  const blocks: DocBlock[] = [{ kind: 'fields', fields: details, columns: 1 }];
  if (paidInFull)
    blocks.push({ kind: 'stamp', text: 'PAID IN FULL', tone: 'success' });
  if (reversed && text(rc.reversal_reason))
    blocks.push({
      kind: 'paragraph',
      text: `Reversed: ${text(rc.reversal_reason)}`,
    });
  sections.push({ title: 'Payment Details', blocks });
  sections.push({
    title: 'Acknowledgement',
    blocks: [
      {
        kind: 'signatures',
        signatories: [{ role: 'Received By', name: userName(rc.receiver) }],
        stamp: true,
      },
    ],
  });

  const quotationNo = text(inv?.quotation?.quotation_no);
  const policyNo = text(inv?.policy?.policy_no);
  return {
    docType: 'RECEIPT',
    title: 'RECEIPT',
    subtitle: compact([
      'Official receipt',
      inv?.invoice_no && `for invoice ${inv.invoice_no}`,
    ]).join(' '),
    number: text(rc.receipt_no),
    ...issuerOf(src.issuer, src.logo),
    reference: compactFields([
      ['Receipt No.', rc.receipt_no],
      ['Payment Date', formatDateTime(rc.received_at ?? rc.created_at)],
      ['Invoice No.', inv?.invoice_no],
      ['Quotation No.', quotationNo],
      ['Policy No.', policyNo],
      ['Branch', rc.branch?.name ?? inv?.branch?.name],
      ['Received By', userName(rc.receiver)],
    ]),
    badge: reversed
      ? { text: 'REVERSED', tone: 'danger' }
      : paidInFull
        ? { text: 'PAID', tone: 'success' }
        : { text: 'RECEIVED', tone: 'success' },
    sections,
    watermark: reversed ? 'REVERSED' : '',
    generatedAt: formatDateTime(src.now ?? new Date()),
    terms:
      'This receipt is valid only after the payment has been cleared by the bank or provider.',
  };
}

function userName(u: Rec | null | undefined) {
  if (!u) return '';
  return (
    text(u.full_name) ||
    text(u.name) ||
    compact([u.first_name, u.last_name]).join(' ') ||
    text(
      u.profile?.first_name &&
        `${u.profile.first_name} ${u.profile.last_name ?? ''}`,
    ) ||
    text(u.email)
  );
}
