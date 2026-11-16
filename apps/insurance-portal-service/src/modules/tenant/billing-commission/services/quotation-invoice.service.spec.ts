import { quotationTaxHarness } from '../../../../../test/support/quotation-tax-fixture';
import { validatedInvoiceTax } from '../utils/quotation-invoice-tax';
describe('Quotation invoices preserve the agreed price and the complete tax breakdown', () => {
  it('splits a tax-inclusive payable into net premium and original VAT', async () => {
    const f = quotationTaxHarness(),
      i = await f.service.createOrReuseQuotationInvoice(f.manager, f.params);
    expect(i).toMatchObject({
      gross_amount: '100.00',
      tax_amount: '18.00',
      charges_amount: '0.00',
      total_amount: '118.00',
      status: 'DRAFT',
    });
    expect(i.items.map((l) => l.total_amount)).toEqual(['100.00', '18.00']);
    expect(validatedInvoiceTax(i).tax).toBe('18.00');
  });
  it('reuses a verified original across payment-workflow revisions', async () => {
    const f = quotationTaxHarness(),
      i = await f.service.createOrReuseQuotationInvoice(f.manager, f.params);
    const reused = await f.service.createOrReuseQuotationInvoice(f.manager, {
      ...f.params,
      workflowRevision: 9,
    });
    expect(reused.id).toBe(i.id);
    expect(f.invoiceRepo.save).toHaveBeenCalledTimes(1);
  });
  it('blocks historical invoices lacking component evidence without overwriting them', async () => {
    const f = quotationTaxHarness(),
      old = {
        id: 'historical',
        gross_amount: '118.00',
        tax_amount: '0.00',
        items: [],
      };
    f.setInvoice(old);
    await expect(
      f.service.createOrReuseQuotationInvoice(f.manager, f.params),
    ).rejects.toThrow('reconcil');
    expect(f.getInvoice()).toBe(old);
    expect(f.invoiceRepo.save).not.toHaveBeenCalled();
  });
  it('rejects missing rate data instead of generating a zero-tax invoice', async () => {
    const f = quotationTaxHarness();
    f.risk.taxes[0].tax_rate = null;
    await expect(
      f.service.createOrReuseQuotationInvoice(f.manager, f.params),
    ).rejects.toThrow('required');
    expect(f.invoiceRepo.save).not.toHaveBeenCalled();
  });
  it('rejects missing tax rows instead of assuming a genuine zero', async () => {
    const f = quotationTaxHarness();
    f.risk.taxes = [];
    await expect(
      f.service.createOrReuseQuotationInvoice(f.manager, f.params),
    ).rejects.toThrow('explicit');
  });
  it('accepts a configured zero rate with explicit zero evidence', async () => {
    const f = quotationTaxHarness();
    f.catalogue[0].tax_rate = '0';
    f.risk.taxes[0].tax_rate = '0';
    f.risk.taxes[0].tax_amount = '0';
    f.risk.premium_including_tax = '100';
    f.quotation.cover_note.total_premium_including_tax = '100';
    const i = await f.service.createOrReuseQuotationInvoice(f.manager, {
      ...f.params,
      amount: '100',
    });
    expect(i.tax_amount).toBe('0.00');
    expect(i.items).toHaveLength(2);
  });
  it('requires and stores a genuine exemption reference', async () => {
    const f = quotationTaxHarness();
    Object.assign(f.risk.taxes[0], {
      is_tax_exempted: 'Y',
      tax_amount: '0',
      tax_exemption_type: 'APPROVED',
      tax_exemption_reference: 'SYNTHETIC-EXEMPTION',
    });
    f.risk.premium_including_tax = '100';
    f.quotation.cover_note.total_premium_including_tax = '100';
    const i = await f.service.createOrReuseQuotationInvoice(f.manager, {
      ...f.params,
      amount: '100',
    });
    expect(validatedInvoiceTax(i).lines[0].charges[0]).toMatchObject({
      amount: '0.00',
      exempt: true,
      exemptionReference: 'SYNTHETIC-EXEMPTION',
    });
  });
  it('rejects unsupported exemption claims', async () => {
    const f = quotationTaxHarness();
    f.risk.taxes[0].is_tax_exempted = 'Y';
    await expect(
      f.service.createOrReuseQuotationInvoice(f.manager, f.params),
    ).rejects.toThrow('Exemption evidence');
  });
  it('preserves separate configured taxes, levies and fees', async () => {
    const f = quotationTaxHarness();
    for (const [code, category, rate, account] of [
      ['LEVY', 'LEVY', '0.02', '4210'],
      ['FEE', 'POLICY_FEE', '0.01', '4300'],
    ]) {
      f.catalogue.push({
        id: code,
        tax_code: code,
        tax_name: code,
        tax_rate: rate,
        is_active: true,
        calculation_options: { category, ledger_account_code: account },
      });
      f.risk.taxes.push({
        ...f.risk.taxes[0],
        tax_code: code,
        tax_rate: rate,
        tax_amount: code === 'LEVY' ? '2' : '1',
      });
    }
    f.risk.premium_including_tax = '121';
    f.quotation.cover_note.total_premium_including_tax = '121';
    const i = await f.service.createOrReuseQuotationInvoice(f.manager, {
        ...f.params,
        amount: '121',
      }),
      b = validatedInvoiceTax(i);
    expect(i).toMatchObject({
      tax_amount: '20.00',
      charges_amount: '1.00',
      total_amount: '121.00',
    });
    expect(b).toMatchObject({ tax: '18.00', levies: '2.00', fees: '1.00' });
    expect(i.items).toHaveLength(4);
  });
  it('uses frozen rates when current catalogue rates have changed', async () => {
    const f = quotationTaxHarness();
    f.catalogue[0].tax_rate = '0.20';
    f.risk.pricing_quote_id = 'original';
    f.risk.pricing_result_hash = 'original-hash';
    f.pricingQuotes.push({
      pricing_quote_id: 'original',
      result_hash: 'original-hash',
      result_payload: {
        charges: [
          {
            charge_code: 'VAT',
            charge_name: 'Original VAT',
            charge_category: 'TAX',
            charge_type: 'PERCENTAGE',
            calculation_base: 'NET_PREMIUM',
            rate: '0.18',
            applied_rule_id: 'original-tax',
            effective_from: '2026-01-01',
            effective_to: '2026-12-31',
          },
        ],
      },
    });
    expect(
      (await f.service.createOrReuseQuotationInvoice(f.manager, f.params))
        .tax_amount,
    ).toBe('18.00');
  });
  it('refuses a changed current rate without original configuration evidence', async () => {
    const f = quotationTaxHarness();
    f.catalogue[0].tax_rate = '0.20';
    await expect(
      f.service.createOrReuseQuotationInvoice(f.manager, f.params),
    ).rejects.toThrow('Historical tax configuration');
  });
  it.each([
    { charge_type: 'FIXED', calculation_base: 'NET_PREMIUM' },
    { charge_type: 'PERCENTAGE', calculation_base: 'PREMIUM_PLUS_CHARGES' },
  ])(
    'holds unsupported original charge models instead of guessing: %j',
    async (model) => {
      const f = quotationTaxHarness();
      f.risk.pricing_quote_id = 'unsupported';
      f.pricingQuotes.push({
        pricing_quote_id: 'unsupported',
        result_payload: {
          charges: [{ charge_code: 'VAT', rate: '0.18', ...model }],
        },
      });
      await expect(
        f.service.createOrReuseQuotationInvoice(f.manager, f.params),
      ).rejects.toThrow('unsupported');
      expect(f.invoiceRepo.save).not.toHaveBeenCalled();
    },
  );
  it('rejects out-of-period configured taxes', async () => {
    const f = quotationTaxHarness();
    f.catalogue[0].calculation_options = { effective_from: '2027-01-01' };
    await expect(
      f.service.createOrReuseQuotationInvoice(f.manager, f.params),
    ).rejects.toThrow('not effective');
  });
  it('reconciles every fleet vehicle and add-on without taxing twice', async () => {
    const f = quotationTaxHarness(),
      second = { ...f.risk, id: 'vehicle-2' };
    f.quotation.cover_note.entries.push({
      id: 'entry-2',
      risks: [second],
      addons: [
        {
          id: 'addon',
          addon_reference: 'ADD',
          premium_excluding_tax_equivalent: '10',
          premium_including_tax: '11.80',
          taxes: [{ ...f.risk.taxes[0], tax_amount: '1.80' }],
        },
      ],
    });
    f.quotation.cover_note.total_premium_excluding_tax = '210';
    f.quotation.cover_note.total_premium_including_tax = '247.80';
    const i = await f.service.createOrReuseQuotationInvoice(f.manager, {
      ...f.params,
      amount: '247.80',
    });
    expect(i).toMatchObject({
      gross_amount: '210.00',
      tax_amount: '37.80',
      total_amount: '247.80',
    });
  });
  it.each(['SHORT_TERM', 'NON_MOTOR'])(
    'keeps the already-priced %s amount unchanged',
    async (flow) => {
      const f = quotationTaxHarness();
      f.quotation.quotation_flow = flow;
      f.risk.premium_before_discount = '27.40';
      f.risk.premium_excluding_tax_equivalent = '27.40';
      f.risk.premium_including_tax = '32.33';
      f.risk.taxes[0].tax_amount = '4.93';
      f.quotation.cover_note.total_premium_excluding_tax = '27.40';
      f.quotation.cover_note.total_premium_including_tax = '32.33';
      const i = await f.service.createOrReuseQuotationInvoice(f.manager, {
        ...f.params,
        amount: '32.33',
      });
      expect(i.total_amount).toBe('32.33');
      expect(i.tax_amount).toBe('4.93');
    },
  );
  it('handles genuine inclusive extraction at a rounding boundary', async () => {
    const f = quotationTaxHarness();
    f.risk.pricing_snapshot = { taxBasis: 'INCLUSIVE' };
    f.risk.premium_before_discount = '84.75';
    f.risk.premium_excluding_tax_equivalent = '84.75';
    f.risk.premium_including_tax = '100';
    f.risk.taxes[0].tax_amount = '15.25';
    f.quotation.cover_note.total_premium_excluding_tax = '84.75';
    f.quotation.cover_note.total_premium_including_tax = '100';
    const i = await f.service.createOrReuseQuotationInvoice(f.manager, {
      ...f.params,
      amount: '100',
    });
    expect(validatedInvoiceTax(i)).toMatchObject({
      net: '84.75',
      tax: '15.25',
      total: '100.00',
    });
  });
  it('rejects changed agreed totals without altering payable', async () => {
    const f = quotationTaxHarness();
    await expect(
      f.service.createOrReuseQuotationInvoice(f.manager, {
        ...f.params,
        amount: '119',
      }),
    ).rejects.toThrow('agreed payable');
    expect(f.invoiceRepo.save).not.toHaveBeenCalled();
  });
  it('retains the positive-total invoice requirement', async () => {
    const f = quotationTaxHarness();
    await expect(
      f.service.createOrReuseQuotationInvoice(f.manager, {
        ...f.params,
        amount: '0',
      }),
    ).rejects.toThrow('greater than zero');
  });
});
