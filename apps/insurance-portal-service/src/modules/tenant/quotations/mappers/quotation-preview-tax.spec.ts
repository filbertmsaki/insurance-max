import { QuotationPreviewMapper } from './quotation-preview.mapper';
import { quotationTaxData } from '../../../../../test/support/quotation-tax-fixture';
describe('Quotation premium summary does not add tax into pre-tax totals', () => {
  it('keeps single-vehicle net premium separate from taxes', () => {
    const f = quotationTaxData();
    Object.assign(f.risk, { discounts: [], premium_after_discount: '100.00' });
    const mapper = Object.create(QuotationPreviewMapper.prototype);
    const s = mapper.buildPremiumSummary(f.quotation.cover_note);
    expect(s).toMatchObject({
      total_premium_before_discount: 100,
      total_premium_after_discount: 100,
      total_tax_amount: 18,
      total_premium_including_tax: 118,
    });
  });
  it('uses the same pre-tax semantics for fleet summaries', () => {
    const f = quotationTaxData(),
      mapper = Object.create(QuotationPreviewMapper.prototype);
    const s = mapper.buildPremiumSummary(f.quotation.cover_note, {
      total_fleet_sum_insured: 1000,
      total_discounts: 5,
      total_taxes: 18,
    });
    expect(s).toMatchObject({
      total_premium_before_discount: 105,
      total_premium_after_discount: 100,
      total_tax_amount: 18,
      total_premium_including_tax: 118,
    });
  });
});
