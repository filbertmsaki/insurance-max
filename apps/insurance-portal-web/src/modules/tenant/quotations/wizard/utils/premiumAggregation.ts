import {
  applyRate,
  roundMoney,
  sumDecimals,
  toDecimal,
} from '@insurance-max/portal-shared/utils/pricing-calculation.util';
import type { RiskPremiumResult } from '@/types/product-engine';
import type { QuotationFormSchemaValues } from '../../schemas';

// The zod-inferred row shape (optional string fields) — not the hand-written
// QuotationRiskFormRow interface, which is what actually flows through the
// wizard's react-hook-form state.
type QuotationRiskFormRow = QuotationFormSchemaValues['risks'][number];
type QuotationFleetRiskFormRow =
  QuotationFormSchemaValues['fleet']['items'][number]['risks_covered'][number];

export function toNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Premium after discount = premium before discount, less all discount line items, floored at 0. */
export function computePremiumAfterDiscount(
  premiumBeforeDiscount: string | number,
  discounts: QuotationRiskFormRow['discounts_offered'],
) {
  const totalDiscount = sumDecimals(
    discounts.map((discount) => discount.discount_amount ?? 0),
  );
  const result = toDecimal(premiumBeforeDiscount).minus(totalDiscount);
  return roundMoney(result.isNegative() ? 0 : result);
}

/** Premium including tax = premium excluding tax equivalent, plus all tax line items. */
export function computePremiumIncludingTax(
  premiumExcludingTaxEquivalent: string | number,
  taxes: QuotationRiskFormRow['taxes_charged'],
) {
  return roundMoney(
    toDecimal(premiumExcludingTaxEquivalent).plus(
      sumDecimals(taxes.map((tax) => tax.tax_amount ?? 0)),
    ),
  );
}

/**
 * Applies a rating-engine result onto a risk row's premium fields — the real
 * schema fields RiskRow.tsx renders (premium_rate, premium_before_discount, ...),
 * not the legacy rate/basic_premium/total_premium fields from the dead-code
 * version of this function.
 *
 * Only sets the fields the API result directly determines:
 *  1. Zero-rate (FIXED rate-type) risks have no sum-insured concept — force
 *     sum_insured/sum_insured_equivalent to '0' regardless of user input.
 *  2. premium_rate = result.percentage_rate.
 *  3. premium_before_discount = result.final_premium (the minimum floor, if
 *     any, is already baked in here — it is a pricing floor, not a discount).
 *
 * Deliberately does NOT compute premium_after_discount/premium_excluding_tax_equivalent/
 * premium_including_tax here. RiskRow.tsx already has a reactive effect that
 * derives those from premium_before_discount plus the row's current
 * discounts_offered/taxes_charged the moment it changes — computing them a
 * second time here, from a snapshot of discounts/taxes that may not reflect
 * a still-in-flight tax_amount recalculation, previously produced a
 * momentarily-wrong premium_including_tax that then got silently corrected a
 * render later. Setting only premium_before_discount and letting that single
 * reactive chain own the rest removes that race entirely.
 */
export function applyRiskPremiumResult(
  row: QuotationRiskFormRow,
  result: RiskPremiumResult,
): QuotationRiskFormRow {
  const isZeroRate = result.percentage_rate === 0;

  return {
    ...row,
    sum_insured: isZeroRate ? '0' : row.sum_insured,
    sum_insured_equivalent: isZeroRate ? '0' : String(result.sum_insured ?? 0),
    premium_rate: String(result.percentage_rate ?? 0),
    premium_before_discount: String(result.final_premium ?? 0),
    rating_result_metadata: {
      pricing_quote_id: result.pricing_quote_id ?? null,
      pricing_status: result.pricing_status ?? null,
      calculated_at: result.calculated_at ?? null,
      expires_at: result.expires_at ?? null,
      input_signature: result.input_signature ?? null,
      quotation_type: result.quotation_type ?? null,
      currency_code: result.currency_code ?? null,
      minimum_applied: result.minimum_applied,
      minimum_amount: result.minimum_amount,
      discount_control: result.discount_control,
      loading_control: result.loading_control,
      validation_errors: result.validation_errors,
      validation_warnings: result.validation_warnings,
    },
  };
}

export function applyFleetRiskPremiumResult(
  row: QuotationFleetRiskFormRow,
  result: RiskPremiumResult,
): QuotationFleetRiskFormRow {
  const isZeroRate = result.percentage_rate === 0;

  return {
    ...row,
    sum_insured: isZeroRate ? '0' : row.sum_insured,
    sum_insured_equivalent: isZeroRate ? '0' : String(result.sum_insured ?? 0),
    premium_rate: String(result.percentage_rate ?? 0),
    premium_before_discount: String(result.final_premium ?? 0),
    rating_result_metadata: {
      pricing_quote_id: result.pricing_quote_id ?? null,
      pricing_status: result.pricing_status ?? null,
      calculated_at: result.calculated_at ?? null,
      expires_at: result.expires_at ?? null,
      input_signature: result.input_signature ?? null,
      quotation_type: result.quotation_type ?? null,
      currency_code: result.currency_code ?? null,
      minimum_applied: result.minimum_applied,
      minimum_amount: result.minimum_amount,
      discount_control: result.discount_control,
      loading_control: result.loading_control,
      validation_errors: result.validation_errors,
      validation_warnings: result.validation_warnings,
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
  return roundMoney(
    sumDecimals(
      rows.map((row) => {
        const value = Number(row[field]);
        return Number.isFinite(value) ? value : 0;
      }),
    ),
  );
}

export function recomputeFleetRiskRow(
  row: QuotationFleetRiskFormRow,
): QuotationFleetRiskFormRow {
  const premiumBeforeDiscount = row.premium_before_discount;
  const refreshedDiscounts = (row.discounts_offered ?? []).map((discount) => {
    if (!discount.discount_rate) return discount;

    return {
      ...discount,
      discount_amount: String(
        roundMoney(
          applyRate(
            toNumber(premiumBeforeDiscount),
            toNumber(discount.discount_rate),
          ),
        ),
      ),
    };
  });

  const premiumAfterDiscount = computePremiumAfterDiscount(
    premiumBeforeDiscount,
    refreshedDiscounts,
  );
  const premiumExcludingTaxEquivalent = premiumAfterDiscount;
  const refreshedTaxes = (row.taxes_charged ?? []).map((tax) => {
    const rate = toNumber(tax.tax_rate);
    const taxAmount = tax.is_tax_exempted
      ? 0
      : roundMoney(applyRate(premiumExcludingTaxEquivalent, rate));

    return {
      ...tax,
      tax_amount: String(taxAmount),
    };
  });

  return {
    ...row,
    discounts_offered: refreshedDiscounts,
    taxes_charged: refreshedTaxes,
    premium_after_discount: String(premiumAfterDiscount),
    premium_excluding_tax_equivalent: String(premiumExcludingTaxEquivalent),
    premium_including_tax: String(
      computePremiumIncludingTax(
        premiumExcludingTaxEquivalent,
        refreshedTaxes,
      ),
    ),
  };
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
        roundMoney(
          sumDecimals(
            rows.flatMap((row) =>
              (row.discounts_offered ?? []).map(
                (discount) => discount.discount_amount || 0,
              ),
            ),
          ),
        ),
    ),
    total_tax: String(
      sumField(rows, 'tax_amount') ||
        roundMoney(
          sumDecimals(
            rows.flatMap((row) =>
              (row.taxes_charged ?? []).map((tax) => tax.tax_amount || 0),
            ),
          ),
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

export function aggregateFleetRiskTotals(
  items: QuotationFormSchemaValues['fleet']['items'],
): QuotationPremiumTotals {
  const rows = items.flatMap((item) =>
    item.risks_covered.map((risk) => ({
      sum_insured: risk.sum_insured,
      basic_premium: risk.premium_after_discount,
      discount_amount: String(
        sumDecimals(
          risk.discounts_offered.map((discount) => discount.discount_amount || 0),
        ),
      ),
      tax_amount: String(
        sumDecimals(risk.taxes_charged.map((tax) => tax.tax_amount || 0)),
      ),
      charges_amount: '',
      commission_amount: '',
      total_premium: risk.premium_including_tax,
      premium_after_discount: risk.premium_after_discount,
      premium_excluding_tax_equivalent: risk.premium_excluding_tax_equivalent,
      premium_including_tax: risk.premium_including_tax,
      discounts_offered: risk.discounts_offered,
      taxes_charged: risk.taxes_charged,
    })),
  ) as QuotationRiskFormRow[];

  return aggregateRiskTotals(rows);
}
