import { describe, expect, it } from 'vitest';
import {
  createEmptyFleetDetails,
  createEmptyRiskDiscountRow,
  createEmptyRiskRow,
  createEmptyRiskTaxRow,
} from '../../schemas';
import {
  aggregateFleetRiskTotals,
  aggregateRiskTotals,
  applyFleetRiskPremiumResult,
  applyRiskPremiumResult,
  computePremiumAfterDiscount,
  computePremiumIncludingTax,
  recomputeFleetRiskRow,
} from './premiumAggregation';

describe('premiumAggregation', () => {
  it('keeps wizard single-risk totals aligned with the calculator payable premium', () => {
    const row = createEmptyRiskRow();
    row.risk_id = 'risk-1';
    row.risk_code = 'MOTOR-COMP';
    row.sum_insured = '10000000';
    row.discounts_offered = [
      {
        ...createEmptyRiskDiscountRow(),
        discount_rate: '0.05',
        discount_amount: '17500',
        request_reason_code: 'LOYALTY',
        request_comment: 'Preferred renewal terms',
      },
    ];
    row.taxes_charged = [
      {
        ...createEmptyRiskTaxRow(),
        tax_rate: '0.18',
        tax_amount: '59850',
      },
    ];

    const result = {
      risk_id: 'risk-1',
      risk_code: 'MOTOR-COMP',
      risk_name: 'Private Comprehensive',
      sum_insured: 10000000,
      percentage_rate: 0.035,
      final_premium: 350000,
      premium_including_charges: 392350,
      pricing_quote_id: 'PQ-2026-00000041',
      pricing_status: 'CALCULATED',
      calculated_at: '2026-07-27T09:00:00.000Z',
      expires_at: '2026-07-28T09:00:00.000Z',
      input_signature: 'signature-1',
      quotation_type: 'MOTOR',
      currency_code: 'TZS',
      minimum_applied: false,
      minimum_amount: 250000,
      discount_control: {
        max_rate: 0.15,
        max_amount: 50000,
        approval_threshold_rate: 0.05,
        approval_threshold_amount: 25000,
        effective_from: '2026-01-01',
        effective_to: '2026-12-31',
      },
      loading_control: {
        max_rate: 0.1,
        max_amount: 100000,
        approval_threshold_rate: 0.025,
        approval_threshold_amount: 15000,
        effective_from: '2026-01-01',
        effective_to: '2026-12-31',
      },
      validation_errors: [],
      validation_warnings: ['Referral to underwriting required'],
      premium_breakdown: {
        totals: {
          payable_premium: 392350,
        },
      },
    } as any;

    const pricedRow = applyRiskPremiumResult(row, result);
    const premiumAfterDiscount = computePremiumAfterDiscount(
      pricedRow.premium_before_discount,
      pricedRow.discounts_offered,
    );
    const premiumExcludingTaxEquivalent = premiumAfterDiscount;
    const premiumIncludingTax = computePremiumIncludingTax(
      premiumExcludingTaxEquivalent,
      pricedRow.taxes_charged,
    );
    const totals = aggregateRiskTotals([
      {
        ...pricedRow,
        premium_after_discount: String(premiumAfterDiscount),
        premium_excluding_tax_equivalent: String(premiumExcludingTaxEquivalent),
        premium_including_tax: String(premiumIncludingTax),
      },
    ]);

    expect(Number(totals.total_premium)).toBe(392350);
    expect(Number(totals.total_premium)).toBe(
      result.premium_breakdown.totals.payable_premium,
    );
    expect(
      pricedRow.rating_result_metadata?.discount_control?.approval_threshold_rate,
    ).toBe(0.05);
    expect(
      pricedRow.rating_result_metadata?.loading_control?.approval_threshold_amount,
    ).toBe(15000);
    expect(pricedRow.rating_result_metadata?.validation_warnings).toEqual([
      'Referral to underwriting required',
    ]);
  });

  it('recomputes fleet discounts and taxes from the calculated premium', () => {
    const fleet = createEmptyFleetDetails();
    const baseRisk = fleet.items[0].risks_covered[0];
    const firstRisk = recomputeFleetRiskRow({
      ...baseRisk,
      client_ref: 'fleet-risk-1',
      risk_id: 'risk-1',
      risk_code: 'MOTOR-COMP',
      sum_insured: '8000000',
      premium_before_discount: '280000',
      discounts_offered: [
        {
          ...createEmptyRiskDiscountRow(),
          discount_rate: '0.05',
        },
      ],
      taxes_charged: [
        {
          ...createEmptyRiskTaxRow(),
          tax_rate: '0.18',
        },
      ],
    });
    const secondRisk = recomputeFleetRiskRow({
      ...baseRisk,
      client_ref: 'fleet-risk-2',
      risk_id: 'risk-2',
      risk_code: 'MOTOR-TP',
      sum_insured: '6000000',
      premium_before_discount: '120000',
      discounts_offered: [
        {
          ...createEmptyRiskDiscountRow(),
          discount_rate: '0.1',
        },
      ],
      taxes_charged: [
        {
          ...createEmptyRiskTaxRow(),
          tax_rate: '0.18',
        },
      ],
    });

    fleet.items[0].risks_covered = [firstRisk, secondRisk];

    const totals = aggregateFleetRiskTotals(fleet.items);

    expect(firstRisk.discounts_offered[0].discount_amount).toBe('14000');
    expect(firstRisk.taxes_charged[0].tax_amount).toBe('47880');
    expect(firstRisk.premium_including_tax).toBe('313880');
    expect(secondRisk.discounts_offered[0].discount_amount).toBe('12000');
    expect(secondRisk.taxes_charged[0].tax_amount).toBe('19440');
    expect(secondRisk.premium_including_tax).toBe('127440');
    expect(totals.sum_insured).toBe('14000000');
    expect(totals.total_discount).toBe('26000');
    expect(totals.total_tax).toBe('67320');
    expect(totals.total_premium).toBe('441320');
  });

  it('applies fleet pricing metadata to each risk row', () => {
    const fleet = createEmptyFleetDetails();
    const row = fleet.items[0].risks_covered[0];
    row.sum_insured = '5000000';

    const applied = applyFleetRiskPremiumResult(row, {
      risk_id: 'risk-3',
      risk_code: 'MOTOR-FIRE',
      risk_name: 'Fleet Fire',
      sum_insured: 5000000,
      percentage_rate: 0.02,
      final_premium: 100000,
      pricing_quote_id: 'PQ-2026-00000042',
      pricing_status: 'CALCULATED',
      validation_errors: ['Registration number is required'],
      validation_warnings: ['Discount request pending approval'],
      discount_control: {
        max_rate: 0.1,
        max_amount: 25000,
        approval_threshold_rate: 0.03,
        approval_threshold_amount: 10000,
        effective_from: '2026-01-01',
        effective_to: '2026-12-31',
      },
      loading_control: {
        max_rate: 0.2,
        max_amount: 50000,
        approval_threshold_rate: 0.05,
        approval_threshold_amount: 20000,
        effective_from: '2026-01-01',
        effective_to: '2026-12-31',
      },
    } as any);

    expect(applied.sum_insured_equivalent).toBe('5000000');
    expect(applied.premium_rate).toBe('0.02');
    expect(applied.premium_before_discount).toBe('100000');
    expect(applied.rating_result_metadata?.pricing_quote_id).toBe(
      'PQ-2026-00000042',
    );
    expect(applied.rating_result_metadata?.validation_errors).toEqual([
      'Registration number is required',
    ]);
    expect(applied.rating_result_metadata?.validation_warnings).toEqual([
      'Discount request pending approval',
    ]);
  });
});
