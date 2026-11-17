import { randomUUID } from 'node:crypto';
import { ProductDefinitionHashService } from '@insurance-max/shared-kernel';
import { EntityManager } from 'typeorm';
import { QuotationInvoiceService } from '../../src/modules/tenant/billing-commission/services/quotation-invoice.service';
import { Quotation } from '../../src/modules/tenant/quotations/entities/quotation.entity';
import { Invoice } from '../../src/modules/tenant/billing-commission/entities/invoice.entity';
import { InvoiceItem } from '../../src/modules/tenant/billing-commission/entities/invoice-item.entity';
import { Tax } from '../../src/modules/tenant/taxes/entities/tax.entity';
import { PricingQuote } from '../../src/modules/tenant/pricing/entities/pricing-quote.entity';
export function quotationTaxData() {
  const companyId = randomUUID(),
    quoteId = randomUUID(),
    customerId = randomUUID(),
    riskId = randomUUID();
  const catalogue: any[] = [
    {
      id: randomUUID(),
      company_id: companyId,
      tax_code: 'VAT',
      tax_name: 'Configured VAT',
      tax_rate: '0.18',
      is_active: true,
      calculation_options: null,
    },
  ];
  const risk: any = {
    id: riskId,
    risk_code: 'SYNTHETIC_RISK',
    pricing_quote_id: null,
    pricing_result_hash: null,
    pricing_snapshot: null,
    premium_before_discount: '100.00',
    premium_excluding_tax_equivalent: '100.00',
    premium_including_tax: '118.00',
    taxes: [
      {
        id: randomUUID(),
        tax_code: 'VAT',
        tax_rate: '0.18',
        tax_amount: '18.00',
        is_tax_exempted: 'N',
        tax_exemption_type: null,
        tax_exemption_reference: null,
      },
    ],
  };
  const quotation: any = {
    id: quoteId,
    company_id: companyId,
    customer_id: customerId,
    workflow_revision: 3,
    deleted_at: null,
    cover_note: {
      id: randomUUID(),
      quotation_id: quoteId,
      currency_code: 'USD',
      cover_note_start_date: '2026-11-15',
      total_premium_excluding_tax: '100.00',
      total_premium_including_tax: '118.00',
      entries: [{ id: randomUUID(), risks: [risk], addons: [] }],
    },
  };
  const params = {
    companyId,
    quotationId: quoteId,
    quotationNumber: 'SYNTHETIC-Q1',
    workflowRevision: 3,
    insurerCompanyId: companyId,
    customerId,
    branchId: null,
    currencyCode: 'USD',
    amount: '118.00',
    pricingResultHash: null,
    finalizationHash: 'f'.repeat(64),
    sourceSnapshot: { source: 'synthetic-quotation' },
    createdBy: randomUUID(),
  };
  return {
    companyId,
    quoteId,
    customerId,
    riskId,
    catalogue,
    risk,
    quotation,
    params,
    pricingQuotes: [] as any[],
  };
}
export function quotationTaxHarness() {
  const d = quotationTaxData(),
    items: any[] = [];
  let invoice: any = null;
  const invoiceRepo = {
    findOne: jest.fn(async () => invoice),
    create: jest.fn((v) => v),
    save: jest.fn(async (v) => {
      invoice = { id: randomUUID(), ...v, items };
      return invoice;
    }),
    findOneOrFail: jest.fn(async () => invoice),
  };
  const itemRepo = {
    save: jest.fn(async (v) => {
      items.push({ id: randomUUID(), ...v });
      return v;
    }),
  };
  const manager = {
    queryRunner: { isTransactionActive: true },
    query: jest.fn(async () => [{ id: d.quoteId }]),
    getRepository: jest.fn((c) => {
      if (c === Invoice) return invoiceRepo;
      if (c === InvoiceItem) return itemRepo;
      if (c === Quotation) return { findOne: jest.fn(async () => d.quotation) };
      if (c === Tax) return { find: jest.fn(async () => d.catalogue) };
      if (c === PricingQuote)
        return { find: jest.fn(async () => d.pricingQuotes) };
      throw new Error('Unexpected repository');
    }),
  };
  const service = new QuotationInvoiceService(
    new ProductDefinitionHashService(),
    { generateInvoiceNumber: jest.fn(async () => 'SYNTHETIC-I1') } as never,
  );
  return {
    ...d,
    service,
    manager: manager as unknown as EntityManager,
    invoiceRepo,
    itemRepo,
    items,
    getInvoice: () => invoice,
    setInvoice: (i: any) => {
      invoice = i;
    },
  };
}
