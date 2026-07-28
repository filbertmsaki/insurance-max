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
  computeDiscountAmount,
  computePremiumAfterDiscount,
  computePremiumIncludingTax,
  computeTaxAmount,
  recomputeRiskRow,
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
      sum_insured_equivalent: 10000000,
      percentage_rate: 0.035,
      premium_rate: 0.035,
      final_premium: 350000,
      premium_including_charges: 392350,
      premium_before_discount: 350000,
      discount_type: 'PERCENTAGE',
      discount_rate: 0.05,
      discount_amount: 17500,
      premium_after_discount: 332500,
      premium_excluding_tax_equivalent: 332500,
      charges: [
        {
          applied_rule_id: 'charge-rule-1',
          charge_code: 'VAT-MAINLAND',
          charge_name: 'VAT',
          charge_category: 'TAX',
          charge_scope: 'RISK',
          charge_type: 'PERCENTAGE',
          calculation_base: 'NET_PREMIUM',
          base_amount: 332500,
          rate: 0.18,
          fixed_amount: null,
          minimum_charge_amount: null,
          maximum_charge_amount: null,
          computed_amount: 59850,
          is_taxable: false,
          effective_from: '2020-01-01',
          effective_to: '2999-12-31',
        },
      ],
      premium_including_tax: 392350,
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

  it('maps legacy pricing responses into wizard premium fields without zeroing them out', () => {
    const row = createEmptyRiskRow();
    row.risk_id = 'risk-1';
    row.risk_code = 'SP014001000001';
    row.sum_insured = '50000000';

    const pricedRow = applyRiskPremiumResult(
      row,
      {
        risk_id: 'risk-1',
        risk_code: 'SP014001000001',
        risk_name: 'Motor Comprehensive',
        sum_insured: 50000000,
        base_premium: 1750000,
        gross_premium: 1750000,
        final_premium: 1750000,
        percentage_rate: 0.035,
        charges: [],
        premium_including_charges: 1750000,
        minimum_amount: 250000,
        minimum_applied: false,
        premium_breakdown: {
          items: [
            {
              premium_after_discount: 1750000,
              raw_premium: 1750000,
            },
          ],
          totals: {
            raw_premium: 1750000,
            premium_after_discount: 1750000,
            payable_premium: 1750000,
          },
        },
        discount_control: {
          max_rate: null,
          max_amount: null,
          approval_threshold_rate: null,
          approval_threshold_amount: null,
          effective_from: null,
          effective_to: null,
        },
        loading_control: {
          max_rate: null,
          max_amount: null,
          approval_threshold_rate: null,
          approval_threshold_amount: null,
          effective_from: null,
          effective_to: null,
        },
        validation_errors: [],
        validation_warnings: [],
      } as any,
    );

    expect(pricedRow.premium_before_discount).toBe('1750000');
    expect(pricedRow.premium_after_discount).toBe('1750000');
    expect(pricedRow.premium_excluding_tax_equivalent).toBe('1750000');
    expect(pricedRow.premium_including_tax).toBe('1750000');
  });

  it('clears stale tax amounts when the recalculation result no longer returns a charge for that tax code', () => {
    const row = createEmptyRiskRow();
    row.risk_id = 'risk-1';
    row.risk_code = 'MOTOR-COMP';
    row.sum_insured = '10000000';
    row.taxes_charged = [
      {
        ...createEmptyRiskTaxRow(),
        tax_code: 'WITHHOLDING',
        tax_rate: '0.10',
        tax_amount: '35000',
      },
    ];

    const pricedRow = applyRiskPremiumResult(
      row,
      {
        risk_id: 'risk-1',
        risk_code: 'MOTOR-COMP',
        risk_name: 'Private Comprehensive',
        sum_insured: 10000000,
        percentage_rate: 0.035,
        premium_rate: 0.035,
        premium_before_discount: 350000,
        premium_after_discount: 350000,
        premium_excluding_tax_equivalent: 350000,
        premium_including_tax: 350000,
        premium_including_charges: 350000,
        charges: [],
        discount_control: {
          max_rate: null,
          max_amount: null,
          approval_threshold_rate: null,
          approval_threshold_amount: null,
          effective_from: null,
          effective_to: null,
        },
        loading_control: {
          max_rate: null,
          max_amount: null,
          approval_threshold_rate: null,
          approval_threshold_amount: null,
          effective_from: null,
          effective_to: null,
        },
        validation_errors: [],
        validation_warnings: [],
      } as any,
    );

    expect(pricedRow.taxes_charged[0].tax_amount).toBe('0');
  });

  it('calculates discount from premium before discount and tax from premium excluding tax equivalent', () => {
    expect(computeDiscountAmount('280000', '0.10')).toBe(28000);
    expect(computeTaxAmount('252000', '0.18')).toBe(45360);
    expect(computeTaxAmount('252000', '0.18', true)).toBe(0);
  });

  it('recomputes a single risk row discount and tax amounts from the visible premium fields', () => {
    const row = createEmptyRiskRow();
    row.premium_before_discount = '280000';
    row.discounts_offered = [
      {
        ...createEmptyRiskDiscountRow(),
        discount_type: '1',
        discount_rate: '0.10',
      },
    ];
    row.taxes_charged = [
      {
        ...createEmptyRiskTaxRow(),
        tax_code: 'VAT-MAINLAND',
        tax_rate: '0.18',
      },
    ];

    const recomputed = recomputeRiskRow(row);

    expect(recomputed.discounts_offered[0].discount_amount).toBe('28000');
    expect(recomputed.premium_after_discount).toBe('252000');
    expect(recomputed.premium_excluding_tax_equivalent).toBe('252000');
    expect(recomputed.taxes_charged[0].tax_amount).toBe('45360');
    expect(recomputed.premium_including_tax).toBe('297360');
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
