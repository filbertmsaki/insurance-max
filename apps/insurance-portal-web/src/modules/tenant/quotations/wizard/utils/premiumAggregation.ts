import type { RiskPremiumResult } from '@/types/product-engine';
import type { QuotationFormSchemaValues } from '../../schemas';

// The zod-inferred row shape (optional string fields) — not the hand-written
// QuotationRiskFormRow interface, which is what actually flows through the
// wizard's react-hook-form state.
type QuotationRiskFormRow = QuotationFormSchemaValues['risks'][number];

/**
 * Applies a rating-engine result onto a risk row's read-only computed fields.
 *
 * The rating engine (`RiskPremiumResult`) only returns base_premium/gross_premium/
 * final_premium — it does not break the total into discount/tax/charges/commission
 * line items (no such fields exist on the response), so those stay at '0' here.
 * This mirrors a gap already flagged in the wizard plan: reliable discount/tax/
 * charges/commission breakdown needs a taxes/levies reference source that
 * doesn't exist yet.
 */
export function applyRiskPremiumResult(
  row: QuotationRiskFormRow,
  result: RiskPremiumResult,
): QuotationRiskFormRow {
  return {
    ...row,
    rate: String(result.percentage_rate ?? 0),
    basic_premium: String(result.base_premium ?? 0),
    discount_amount: '0',
    tax_amount: '0',
    charges_amount: '0',
    commission_amount: '0',
    total_premium: String(result.final_premium ?? result.gross_premium ?? 0),
    net_premium: String(result.final_premium ?? result.gross_premium ?? 0),
    rating_result_metadata: result,
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
    const value = Number(row[field] as string);
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
