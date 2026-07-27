import { PricingChargeService } from './pricing-charge.service';

describe('PricingChargeService', () => {
  it('calculates percentage and fixed charges with min/max caps', async () => {
    const repository = {
      find: jest.fn().mockResolvedValue([
        {
          id: 'rule-1',
          company_id: 'company-1',
          category_id: null,
          product_id: 'product-1',
          risk_id: 'risk-1',
          tax_name: 'VAT Mainland',
          tax_code: 'VAT-MAINLAND',
          charge_category: 'TAX',
          tax_type: 'PERCENTAGE',
          tax_rate: '0.18',
          tax_amount: null,
          is_taxable: false,
          minimum_charge_amount: null,
          maximum_charge_amount: null,
          calculation_base: 'NET_PREMIUM',
          effective_from: '2026-01-01',
          effective_to: '2026-12-31',
          status: 'ACTIVE',
          created_at: new Date('2026-01-01T00:00:00.000Z'),
        },
        {
          id: 'rule-2',
          company_id: 'company-1',
          category_id: null,
          product_id: 'product-1',
          risk_id: null,
          tax_name: 'Policy Fee',
          tax_code: 'POLICY-FEE',
          charge_category: 'POLICY_FEE',
          tax_type: 'FIXED',
          tax_rate: null,
          tax_amount: '5000',
          is_taxable: true,
          minimum_charge_amount: '6000',
          maximum_charge_amount: '7000',
          calculation_base: 'GROSS_PREMIUM',
          effective_from: '2026-01-01',
          effective_to: '2026-12-31',
          status: 'ACTIVE',
          created_at: new Date('2026-01-01T00:00:00.000Z'),
        },
      ]),
    };
    const service = new PricingChargeService(repository as any);

    const result = await service.calculateCharges('company-1', {
      category_id: 'category-1',
      product_id: 'product-1',
      risk_id: 'risk-1',
      effective_date: '2026-07-27',
      basic_premium: 80000,
      net_premium: 100000,
      gross_premium: 100000,
    });

    expect(result.charges).toHaveLength(2);
    expect(result.charges[0]).toMatchObject({
      charge_code: 'VAT-MAINLAND',
      computed_amount: 18000,
    });
    expect(result.charges[1]).toMatchObject({
      charge_code: 'POLICY-FEE',
      computed_amount: 6000,
    });
    expect(result.total_charge_amount).toBe(24000);
    expect(result.taxable_charge_amount).toBe(6000);
    expect(result.non_taxable_charge_amount).toBe(18000);
    expect(result.premium_including_charges).toBe(124000);
  });

  it('filters expired rules and rounds levy and fee charges from different bases', async () => {
    const repository = {
      find: jest.fn().mockResolvedValue([
        {
          id: 'rule-levy',
          company_id: 'company-1',
          category_id: 'category-1',
          product_id: null,
          risk_id: null,
          tax_name: 'Training Levy',
          tax_code: 'TRAINING-LEVY',
          charge_category: 'LEVY',
          tax_type: 'PERCENTAGE',
          tax_rate: '0.015',
          tax_amount: null,
          is_taxable: false,
          minimum_charge_amount: null,
          maximum_charge_amount: null,
          calculation_base: 'BASIC_PREMIUM',
          effective_from: '2026-01-01',
          effective_to: '2026-12-31',
          status: 'ACTIVE',
          created_at: new Date('2026-01-01T00:00:00.000Z'),
        },
        {
          id: 'rule-fee',
          company_id: 'company-1',
          category_id: null,
          product_id: 'product-1',
          risk_id: null,
          tax_name: 'Administration Fee',
          tax_code: 'ADMIN-FEE',
          charge_category: 'ADMINISTRATION_FEE',
          tax_type: 'FIXED',
          tax_rate: null,
          tax_amount: '1234.567',
          is_taxable: true,
          minimum_charge_amount: null,
          maximum_charge_amount: null,
          calculation_base: 'NET_PREMIUM',
          effective_from: '2026-01-01',
          effective_to: '2026-12-31',
          status: 'ACTIVE',
          created_at: new Date('2026-01-01T00:00:00.000Z'),
        },
        {
          id: 'rule-expired',
          company_id: 'company-1',
          category_id: null,
          product_id: 'product-1',
          risk_id: null,
          tax_name: 'Expired Fee',
          tax_code: 'EXPIRED-FEE',
          charge_category: 'FEE',
          tax_type: 'FIXED',
          tax_rate: null,
          tax_amount: '999',
          is_taxable: false,
          minimum_charge_amount: null,
          maximum_charge_amount: null,
          calculation_base: 'NET_PREMIUM',
          effective_from: '2025-01-01',
          effective_to: '2025-12-31',
          status: 'ACTIVE',
          created_at: new Date('2025-01-01T00:00:00.000Z'),
        },
      ]),
    };
    const service = new PricingChargeService(repository as any);

    const result = await service.calculateCharges('company-1', {
      category_id: 'category-1',
      product_id: 'product-1',
      risk_id: 'risk-1',
      effective_date: '2026-07-27',
      basic_premium: 12345.67,
      net_premium: 250000,
      gross_premium: 260000,
    });

    expect(result.charges).toEqual([
      expect.objectContaining({
        charge_code: 'TRAINING-LEVY',
        charge_category: 'LEVY',
        calculation_base: 'BASIC_PREMIUM',
        computed_amount: 185.19,
      }),
      expect.objectContaining({
        charge_code: 'ADMIN-FEE',
        charge_category: 'ADMINISTRATION_FEE',
        charge_type: 'FIXED',
        computed_amount: 1234.57,
      }),
    ]);
    expect(result.total_charge_amount).toBe(1419.76);
    expect(result.taxable_charge_amount).toBe(1234.57);
    expect(result.non_taxable_charge_amount).toBe(185.19);
    expect(result.premium_including_charges).toBe(251419.76);
  });
});
