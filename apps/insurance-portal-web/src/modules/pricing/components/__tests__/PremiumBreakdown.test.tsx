import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PremiumBreakdown } from '../PremiumBreakdown';

describe('PremiumBreakdown', () => {
  it('renders the successful premium breakdown, charge lines, and final total', () => {
    render(
      <PremiumBreakdown
        result={
          {
            risk_id: 'risk-1',
            risk_code: 'MOTOR-COMP',
            risk_name: 'Private Comprehensive',
            rate_type: 'PERCENTAGE',
            rule_name: 'Standard private vehicle rate',
            rule_id: 'rule-1',
            rule_version: 2,
            rate_book_id: 'rate-book-1',
            rate_book_code: 'MOTOR-STANDARD',
            rate_book_version: '2026.1',
            sum_insured: 10000000,
            percentage_rate: 0.035,
            base_premium: 350000,
            per_unit_factor_code: null,
            per_unit_value: 0,
            per_unit_amount: 0,
            per_unit_premium: 0,
            fixed_amount: 0,
            minimum_amount: 250000,
            gross_premium: 350000,
            final_premium: 392350,
            minimum_applied: false,
            charges: [
              {
                applied_rule_id: 'charge-1',
                charge_code: 'VAT',
                charge_name: 'VAT Mainland',
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
                effective_from: '2026-01-01',
                effective_to: '2026-12-31',
              },
            ],
            total_charge_amount: 59850,
            taxable_charge_amount: 0,
            non_taxable_charge_amount: 59850,
            premium_including_charges: 392350,
            validation_errors: [],
            validation_warnings: ['Discount requires approval'],
            premium_breakdown: {
              pricing_quote_id: 'PQ-2026-00000031',
              status: 'CALCULATED',
              currency: 'TZS',
              rate_book: {
                code: 'MOTOR-STANDARD',
                version: '2026.1',
              },
              items: [
                {
                  client_reference: 'RISK-001',
                  risk_id: 'risk-1',
                  risk_code: 'MOTOR-COMP',
                  risk_name: 'Private Comprehensive',
                  calculation_method: 'PERCENTAGE',
                  sum_insured: 10000000,
                  rate: 0.035,
                  display_rate_percent: 3.5,
                  raw_premium: 350000,
                  minimum_premium: 250000,
                  minimum_applied: false,
                  loadings: [],
                  discounts: [],
                  premium_after_discount: 332500,
                  taxes: [
                    {
                      charge_code: 'VAT',
                      charge_name: 'VAT Mainland',
                      charge_category: 'TAX',
                      charge_scope: 'RISK',
                      charge_type: 'PERCENTAGE',
                      calculation_base: 'NET_PREMIUM',
                      base_amount: 332500,
                      rate: 0.18,
                      amount: 59850,
                      is_taxable: false,
                    },
                  ],
                  other_charges: [],
                  final_premium: 392350,
                  matched_rule: {
                    rule_id: 'rule-1',
                    rule_name: 'Standard private vehicle rate',
                    rule_version: 2,
                  },
                },
              ],
              totals: {
                base_premium: 350000,
                raw_premium: 350000,
                loadings: 0,
                discounts: 17500,
                premium_after_discount: 332500,
                taxes: 59850,
                other_charges: 0,
                payable_premium: 392350,
              },
              errors: [],
              warnings: [],
              expires_at: '2026-07-28T10:00:00.000Z',
            },
          } as any
        }
      />,
    );

    expect(screen.getByText('Private Comprehensive')).toBeInTheDocument();
    expect(screen.getByText('Total Payable')).toBeInTheDocument();
    expect(screen.getAllByText('392,350.00')).toHaveLength(2);
    expect(screen.getByText('VAT Mainland')).toBeInTheDocument();
    expect(screen.getByText('(VAT)')).toBeInTheDocument();
    expect(screen.getByText('Discount requires approval')).toBeInTheDocument();
    expect(screen.getByText('Final Premium')).toBeInTheDocument();
  });
});
