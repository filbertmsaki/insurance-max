import { describe, expect, it } from 'vitest';
import {
  createEmptyRiskDiscountRow,
  createEmptyRiskRow,
  createEmptyRiskTaxRow,
  quotationRiskRowSchema,
} from '../schemas';

describe('quotationRiskRowSchema — required rate validation', () => {
  it('rejects a discount row that has a discount_type but no discount_rate', () => {
    const row = {
      ...createEmptyRiskRow(),
      discounts_offered: [
        { ...createEmptyRiskDiscountRow(), discount_type: '1', discount_rate: '' },
      ],
    };

    const result = quotationRiskRowSchema.safeParse(row);

    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((current) =>
        current.path.join('.').includes('discount_rate'),
      );
      expect(issue?.message).toBe(
        'Discount rate is required once a discount type is selected.',
      );
    }
  });

  it('accepts a discount row with no discount_type at all (no discount requested)', () => {
    const row = {
      ...createEmptyRiskRow(),
      discounts_offered: [
        { ...createEmptyRiskDiscountRow(), discount_type: '', discount_rate: '' },
      ],
    };

    expect(quotationRiskRowSchema.safeParse(row).success).toBe(true);
  });

  it('accepts a discount row once both discount_type and discount_rate are set', () => {
    const row = {
      ...createEmptyRiskRow(),
      discounts_offered: [
        { ...createEmptyRiskDiscountRow(), discount_type: '1', discount_rate: '0.05' },
      ],
    };

    expect(quotationRiskRowSchema.safeParse(row).success).toBe(true);
  });

  it('rejects a tax row that has a tax_code but no tax_rate (not yet calculated)', () => {
    const row = {
      ...createEmptyRiskRow(),
      taxes_charged: [
        { ...createEmptyRiskTaxRow(), tax_code: 'VAT-MAINLAND', tax_rate: '' },
      ],
    };

    const result = quotationRiskRowSchema.safeParse(row);

    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((current) =>
        current.path.join('.').includes('tax_rate'),
      );
      expect(issue?.message).toBe(
        'Tax rate is required once a tax code is selected.',
      );
    }
  });

  it('accepts a tax row once tax_code and tax_rate (from a resolved calculation) are both set', () => {
    const row = {
      ...createEmptyRiskRow(),
      taxes_charged: [
        { ...createEmptyRiskTaxRow(), tax_code: 'VAT-MAINLAND', tax_rate: '0.18' },
      ],
    };

    expect(quotationRiskRowSchema.safeParse(row).success).toBe(true);
  });
});
