import { randomUUID } from 'node:crypto';
import {
  BILLING_SCHEMA,
  billingProfile,
  normalizeQuotationBilling,
  type QuotationBillingSnapshot,
} from './finance-quotation-billing.types';
import {
  quotationBillingFromLegacyInvoice,
  type LegacyQuotationInvoice,
} from './finance-quotation-billing.adapter';
function snapshot(): QuotationBillingSnapshot {
  const c = {
    gross: '100',
    discount: '5',
    tax: '18',
    charges: '2',
    total: '115',
  };
  return {
    schema: BILLING_SCHEMA,
    quotationId: randomUUID(),
    quotationNumber: 'Q1',
    sourceCompanyId: randomUUID(),
    sourceRevision: 1,
    workflowRevision: 7,
    invoiceId: randomUUID(),
    invoiceNumber: 'I1',
    invoiceSourceRevision: 3,
    invoiceStateVersion: 2,
    policyId: null,
    sourceStatus: 'ISSUED',
    billingDate: '2026-11-15',
    currency: 'USD',
    decimalScale: 2,
    taxPresentation: 'EXCLUSIVE',
    productId: randomUUID(),
    customerId: randomUUID(),
    branchId: null,
    pricingResultHash: null,
    finalizationHash: 'a'.repeat(64),
    paymentReference: null,
    legacyJournalEvidence: { state: 'NOT_ASSESSED', references: [] },
    components: c,
    lines: [{ key: 'PREMIUM', description: 'Premium', ...c }],
  };
}
describe('Quotation memorandum exact input and existing invoice adapter (B13)', () => {
  it('conserves the tax-exclusive source vector without tax policy elections', () => {
    expect(normalizeQuotationBilling(snapshot()).components.total).toBe(
      '115.000000000000',
    );
  });
  it('does not add inclusive tax twice', () => {
    const p = snapshot();
    p.taxPresentation = 'INCLUSIVE';
    p.components.gross = '118';
    p.lines[0].gross = '118';
    expect(normalizeQuotationBilling(p).components.total).toBe(
      '115.000000000000',
    );
  });
  it('keeps unknown embedded tax null', () => {
    const p = snapshot();
    p.taxPresentation = 'UNSPLIT';
    p.components.tax = null;
    p.lines[0].tax = null;
    p.components.gross = '118';
    p.lines[0].gross = '118';
    expect(normalizeQuotationBilling(p).components.tax).toBeNull();
  });
  it('allows a zero quote observation without creating a zero legacy invoice', () => {
    const p = snapshot();
    p.components = {
      gross: '0',
      discount: '0',
      tax: '0',
      charges: '0',
      total: '0',
    };
    p.lines = [{ key: 'ZERO', description: 'Zero quote', ...p.components }];
    p.invoiceId = null;
    p.invoiceNumber = null;
    p.invoiceSourceRevision = null;
    p.invoiceStateVersion = null;
    expect(normalizeQuotationBilling(p).components.total).toBe(
      '0.000000000000',
    );
  });
  it.each(['0.001', '1e2', '-1', 'NaN'])(
    'rejects rounding or malformed money %s',
    (n) => {
      const p = snapshot();
      p.components.total = n;
      expect(() => normalizeQuotationBilling(p)).toThrow();
    },
  );
  it('rejects a balanced header with the wrong component lines', () => {
    const p = snapshot();
    p.lines[0].gross = '99';
    p.lines[0].total = '114';
    expect(() => normalizeQuotationBilling(p)).toThrow();
  });
  it('rejects a tax-inclusive double-counted total', () => {
    const p = snapshot();
    p.taxPresentation = 'INCLUSIVE';
    expect(() => normalizeQuotationBilling(p)).toThrow();
  });
  it('rejects duplicate line identity', () => {
    const p = snapshot();
    p.lines.push({ ...p.lines[0] });
    expect(() => normalizeQuotationBilling(p)).toThrow();
  });
  it('requires a currency/scale without coercion or payment-reference conversion', () => {
    const p = snapshot();
    p.currency = ' usd ';
    expect(() => normalizeQuotationBilling(p)).toThrow();
    const q = snapshot();
    q.paymentReference = {
      id: randomUUID(),
      currency: 'EUR',
      amount: '115',
      state: 'ACTIVE',
    };
    expect(() => normalizeQuotationBilling(q)).toThrow();
  });
  it('keeps workflow and invoice creation revisions distinct', () => {
    const p = normalizeQuotationBilling(snapshot());
    expect(p.sourceRevision).toBe(1);
    expect(p.invoiceSourceRevision).toBe(3);
    expect(p.workflowRevision).toBe(7);
  });
  it('requires explicit original journal evidence and declared inactive purpose', () => {
    expect(() =>
      billingProfile(
        {
          schema: 'FINANCE_QUOTATION_BILLING_RULES_V1',
          purpose: 'POST_REVENUE',
          recognition: 'HELD_INACTIVE',
          maxLines: 10,
        },
        ['DEC-01', 'DEC-12', 'DEC-14'],
      ),
    ).toThrow();
    const p = snapshot();
    p.legacyJournalEvidence = { state: 'PRESENT', references: [] };
    expect(() => normalizeQuotationBilling(p)).toThrow();
  });
  it('bounds and independently gates inactive profile input', () => {
    const p = {
      schema: 'FINANCE_QUOTATION_BILLING_RULES_V1',
      purpose: 'MEMORANDUM_ONLY',
      recognition: 'HELD_INACTIVE',
      maxLines: 10,
    };
    expect(() => billingProfile(p, ['DEC-12', 'DEC-14'])).toThrow();
    expect(() =>
      billingProfile({ ...p, maxLines: 501 }, ['DEC-01', 'DEC-12', 'DEC-14']),
    ).toThrow();
  });
  it('detaches inputs before async use', () => {
    const p = snapshot(),
      r = normalizeQuotationBilling(p);
    p.lines[0].total = '1';
    expect(r.lines[0].total).toBe('115.000000000000');
  });
  const legacy = (): LegacyQuotationInvoice => {
    const s = snapshot();
    return {
      id: s.invoiceId!,
      company_id: s.sourceCompanyId,
      quotation_id: s.quotationId,
      source_type: 'QUOTATION',
      source_record_id: s.quotationId,
      source_revision: 3,
      invoice_type: 'QUOTATION',
      invoice_no: 'I1',
      currency: 'USD',
      customer_id: s.customerId,
      branch_id: null,
      policy_id: null,
      status: 'PAID',
      state_version: 5,
      gross_amount: '118.00',
      discount_amount: '0.00',
      tax_amount: '0.00',
      charges_amount: '0.00',
      total_amount: '118.00',
      pricing_result_hash: null,
      source_snapshot_hash: 'b'.repeat(64),
      items: [
        {
          source_line_type: 'QUOTATION_PREMIUM',
          source_line_id: s.quotationId,
          total_amount: '118.00',
        },
      ],
    };
  };
  const context = () => ({
    quotationNumber: 'Q1',
    sourceRevision: 1,
    workflowRevision: 7,
    billingDate: '2026-11-15',
    decimalScale: 2,
    productId: randomUUID(),
    paymentReference: null,
    legacyJournalEvidence: { state: 'NOT_ASSESSED' as const, references: [] },
  });
  it('rejects the historical zero-tax-column shape until its breakdown is reconciled', () => {
    expect(() =>
      quotationBillingFromLegacyInvoice(legacy(), context()),
    ).toThrow('reconc');
  });
  it('requires an original finalization hash and line linkage', () => {
    const i = legacy();
    i.source_snapshot_hash = null;
    expect(() => quotationBillingFromLegacyInvoice(i, context())).toThrow();
    const j = legacy();
    j.items[0].source_line_id = randomUUID();
    expect(() => quotationBillingFromLegacyInvoice(j, context())).toThrow();
  });
  it('holds legacy shapes requiring an unproven tax/component split', () => {
    const i = legacy();
    i.tax_amount = '18';
    expect(() => quotationBillingFromLegacyInvoice(i, context())).toThrow();
  });
});
