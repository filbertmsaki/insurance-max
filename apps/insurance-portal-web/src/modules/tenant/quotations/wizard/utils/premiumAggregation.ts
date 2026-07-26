import type { RiskPremiumResult } from '@/types/product-engine';
import type { QuotationFormSchemaValues } from '../../schemas';

// The zod-inferred row shape (optional string fields) — not the hand-written
// QuotationRiskFormRow interface, which is what actually flows through the
// wizard's react-hook-form state.
type QuotationRiskFormRow = QuotationFormSchemaValues['risks'][number];

function toNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Premium after discount = premium before discount, less all discount line items, floored at 0. */
export function computePremiumAfterDiscount(
  premiumBeforeDiscount: string | number,
  discounts: QuotationRiskFormRow['discounts_offered'],
) {
  const totalDiscount = discounts.reduce(
    (sum, discount) => sum + toNumber(discount.discount_amount),
    0,
  );
  return Math.max(0, toNumber(premiumBeforeDiscount) - totalDiscount);
}

/** Premium including tax = premium excluding tax equivalent, plus all tax line items. */
export function computePremiumIncludingTax(
  premiumExcludingTaxEquivalent: string | number,
  taxes: QuotationRiskFormRow['taxes_charged'],
) {
  const totalTax = taxes.reduce(
    (sum, tax) => sum + toNumber(tax.tax_amount),
    0,
  );
  return toNumber(premiumExcludingTaxEquivalent) + totalTax;
}

/**
 * Applies a rating-engine result onto a risk row's premium fields — the real
 * schema fields RiskRow.tsx renders (premium_rate, premium_before_discount, ...),
 * not the legacy rate/basic_premium/total_premium fields from the dead-code
 * version of this function.
 *
 * Rule order:
 *  1. Zero-rate (FIXED rate-type) risks have no sum-insured concept — force
 *     sum_insured/sum_insured_equivalent to '0' regardless of user input.
 *  2. premium_rate = result.percentage_rate.
 *  3. premium_before_discount = result.final_premium (the minimum floor, if
 *     any, is already baked in here — it is a pricing floor, not a discount).
 *  4-6. Discounts/tax are re-derived from whatever the row's existing
 *     discounts_offered/taxes_charged rows already contain, so calling this
 *     mid-edit doesn't clobber amounts the user already set.
 */
export function applyRiskPremiumResult(
  row: QuotationRiskFormRow,
  result: RiskPremiumResult,
): QuotationRiskFormRow {
  const isZeroRate = result.percentage_rate === 0;
  const premiumBeforeDiscount = String(result.final_premium ?? 0);
  const premiumAfterDiscount = computePremiumAfterDiscount(
    premiumBeforeDiscount,
    row.discounts_offered,
  );
  const premiumExcludingTaxEquivalent = premiumAfterDiscount;
  const premiumIncludingTax = computePremiumIncludingTax(
    premiumExcludingTaxEquivalent,
    row.taxes_charged,
  );

  return {
    ...row,
    sum_insured: isZeroRate ? '0' : row.sum_insured,
    sum_insured_equivalent: isZeroRate ? '0' : String(result.sum_insured ?? 0),
    premium_rate: String(result.percentage_rate ?? 0),
    premium_before_discount: premiumBeforeDiscount,
    premium_after_discount: String(premiumAfterDiscount),
    premium_excluding_tax_equivalent: String(premiumExcludingTaxEquivalent),
    premium_including_tax: String(premiumIncludingTax),
    rating_result_metadata: {
      minimum_applied: result.minimum_applied,
      minimum_amount: result.minimum_amount,
      validation_errors: result.validation_errors,
    },
  };
}

export interface QuotationPremiumTotals {
  sum_insured: string;
  basic_premium: string;
  total_discount: string;
  total_tax: string;
  total_charges: string;
  total_commission: string;
  total_premium: string;
  net_premium: string;
}

function sumField(
  rows: QuotationRiskFormRow[],
  field: keyof QuotationRiskFormRow,
) {
  return rows.reduce((total, row) => {
    const value = Number(row[field]);
    return total + (Number.isFinite(value) ? value : 0);
  }, 0);
}

/** Rolls all risk rows up into the quotation-level totals shown in the summary sidebar. */
export function aggregateRiskTotals(
  rows: QuotationRiskFormRow[],
): QuotationPremiumTotals {
  return {
    sum_insured: String(sumField(rows, 'sum_insured')),
    basic_premium: String(
      sumField(rows, 'basic_premium') ||
        sumField(rows, 'premium_after_discount') ||
        sumField(rows, 'premium_excluding_tax_equivalent'),
    ),
    total_discount: String(
      sumField(rows, 'discount_amount') ||
        rows.reduce(
          (sum, row) =>
            sum +
            (row.discounts_offered ?? []).reduce(
              (discountTotal, discount) =>
                discountTotal + Number(discount.discount_amount || 0),
              0,
            ),
          0,
        ),
    ),
    total_tax: String(
      sumField(rows, 'tax_amount') ||
        rows.reduce(
          (sum, row) =>
            sum +
            (row.taxes_charged ?? []).reduce(
              (taxTotal, tax) => taxTotal + Number(tax.tax_amount || 0),
              0,
            ),
          0,
        ),
    ),
    total_charges: String(sumField(rows, 'charges_amount')),
    total_commission: String(sumField(rows, 'commission_amount')),
    total_premium: String(
      sumField(rows, 'total_premium') ||
        sumField(rows, 'premium_including_tax'),
    ),
    net_premium: String(
      sumField(rows, 'net_premium') || sumField(rows, 'premium_including_tax'),
    ),
  };
}
