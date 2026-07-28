import { describe, expect, it } from 'vitest';
import {
  buildFleetRiskPricingSignature,
  buildQuotationPricingSignature,
  buildSingleRiskPricingSignature,
} from './pricingStaleness';

describe('pricing staleness signatures', () => {
  it('keeps the same signature for equivalent input objects with different key order', () => {
    const first = buildQuotationPricingSignature({
      currency: 'TZS',
      risk: {
        risk_code: 'MOTOR-COMP',
        sum_insured: 1000000,
      },
      exchange_rate: 1,
    });
    const second = buildQuotationPricingSignature({
      exchange_rate: 1,
      risk: {
        sum_insured: 1000000,
        risk_code: 'MOTOR-COMP',
      },
      currency: 'TZS',
    });

    expect(first).toBe(second);
  });

  it('changes the single-risk signature when quote-sensitive pricing inputs change', () => {
    const base = buildSingleRiskPricingSignature({
      quotation_type: 'MOTOR',
      product_id: 'product-1',
      valid_from: '2026-07-27',
      valid_until: '2027-07-26',
      currency: 'TZS',
      exchange_rate: 1,
      risk: {
        risk_id: 'risk-1',
        risk_code: 'MOTOR-COMP',
        sum_insured: 1000000,
        factor_values: { seating_capacity: 5 },
        discounts_offered: [],
        taxes_charged: [],
      },
    });
    const changedCurrency = buildSingleRiskPricingSignature({
      quotation_type: 'MOTOR',
      product_id: 'product-1',
      valid_from: '2026-07-27',
      valid_until: '2027-07-26',
      currency: 'USD',
      exchange_rate: 2540.125,
      risk: {
        risk_id: 'risk-1',
        risk_code: 'MOTOR-COMP',
        sum_insured: 1000000,
        factor_values: { seating_capacity: 5 },
        discounts_offered: [],
        taxes_charged: [],
      },
    });

    expect(base).not.toBe(changedCurrency);
  });

  it('changes the fleet signature when a vehicle discount or addon changes', () => {
    const base = buildFleetRiskPricingSignature({
      quotation_type: 'MOTOR',
      product_id: 'product-1',
      valid_from: '2026-07-27',
      valid_until: '2027-07-26',
      currency: 'TZS',
      exchange_rate: 1,
      fleet_header: {
        fleet_id: 'FLEET-001',
      },
      item: {
        cover_note_addons: [],
        subject_matters_covered: [],
        motor_dtl: {
          registration_number: 'T123ABC',
        },
      },
      risk: {
        risk_id: 'risk-1',
        risk_code: 'MOTOR-COMP',
        sum_insured: 1000000,
        discounts_offered: [],
        taxes_charged: [],
      },
    });
    const withDiscount = buildFleetRiskPricingSignature({
      quotation_type: 'MOTOR',
      product_id: 'product-1',
      valid_from: '2026-07-27',
      valid_until: '2027-07-26',
      currency: 'TZS',
      exchange_rate: 1,
      fleet_header: {
        fleet_id: 'FLEET-001',
      },
      item: {
        cover_note_addons: [{ addon_code: 'WINDSCREEN', premium_including_tax: '15000' }],
        subject_matters_covered: [],
        motor_dtl: {
          registration_number: 'T123ABC',
        },
      },
      risk: {
        risk_id: 'risk-1',
        risk_code: 'MOTOR-COMP',
        sum_insured: 1000000,
        discounts_offered: [{ discount_rate: '0.05', discount_amount: '5000' }],
        taxes_charged: [],
      },
    });

    expect(base).not.toBe(withDiscount);
  });

  it('ignores backend-computed discount and tax amounts when building pricing signatures', () => {
    const first = buildSingleRiskPricingSignature({
      quotation_type: 'MOTOR',
      product_id: 'product-1',
      valid_from: '2026-07-27',
      valid_until: '2027-07-26',
      currency: 'TZS',
      exchange_rate: 1,
      risk: {
        risk_id: 'risk-1',
        risk_code: 'MOTOR-COMP',
        sum_insured: 1000000,
        factor_values: { seating_capacity: 5 },
        discounts_offered: [
          { discount_type: '1', discount_rate: '0.10', discount_amount: '28000' },
        ],
        taxes_charged: [
          {
            tax_code: 'VAT-MAINLAND',
            tax_rate: '0.18',
            tax_amount: '45360',
            is_tax_exempted: false,
          },
        ],
      },
    });
    const second = buildSingleRiskPricingSignature({
      quotation_type: 'MOTOR',
      product_id: 'product-1',
      valid_from: '2026-07-27',
      valid_until: '2027-07-26',
      currency: 'TZS',
      exchange_rate: 1,
      risk: {
        risk_id: 'risk-1',
        risk_code: 'MOTOR-COMP',
        sum_insured: 1000000,
        factor_values: { seating_capacity: 5 },
        discounts_offered: [
          { discount_type: '1', discount_rate: '0.10', discount_amount: '99999' },
        ],
        taxes_charged: [
          {
            tax_code: 'VAT-MAINLAND',
            tax_rate: '0.18',
            tax_amount: '1',
            is_tax_exempted: false,
          },
        ],
      },
    });

    expect(first).toBe(second);
  });
});
