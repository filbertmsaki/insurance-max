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

export function recomputeRiskTaxTotals(
  row: QuotationFormSchemaValues['risks'][number],
): QuotationFormSchemaValues['risks'][number] {
  const premiumExcludingTax =
    toNumber(row.premium_excluding_tax_equivalent) ||
    toNumber(row.premium_after_discount);
  const taxes = row.taxes_charged.map((tax) => ({
    ...tax,
    tax_amount: String(
      tax.is_tax_exempted
        ? 0
        : roundMoney(applyRate(premiumExcludingTax, toNumber(tax.tax_rate))),
    ),
  }));

  return {
    ...row,
    taxes_charged: taxes,
    premium_including_tax: String(
      computePremiumIncludingTax(premiumExcludingTax, taxes),
    ),
  };
}

/**
 * Maps charge lines from a calculation result onto the risk's existing
 * taxes_charged rows, matched by tax_code — mirroring exactly what the
 * backend's own authoritative recalculation (applyAuthoritativeChargesToRisk
 * in quotations.service.ts) does at quotation-create time, so the wizard's
 * live preview and the persisted result never diverge. An exempted row's
 * tax_amount is always forced to 0 regardless of what the backend computed,
 * since exemption is a business decision made on the frontend, not something
 * the backend charge engine is told about at calculation time.
 */
function applyChargesToTaxRows(
  taxRows: QuotationRiskFormRow['taxes_charged'],
  charges: RiskPremiumResult['charges'] | undefined,
): QuotationRiskFormRow['taxes_charged'] {
  const chargeByCode = new Map(
    (charges ?? []).map((charge) => [charge.charge_code, charge]),
  );

  return taxRows.map((row) => {
    const charge = chargeByCode.get(row.tax_code);
    if (!charge) return row;

    return {
      ...row,
      tax_rate: String(charge.rate ?? 0),
      tax_amount: row.is_tax_exempted ? '0' : String(charge.computed_amount),
    };
  });
}

/**
 * Applies a rating-engine result onto a risk row's premium fields — the real
 * schema fields RiskRow.tsx renders (premium_rate, premium_before_discount, ...).
 *
 * The backend is the sole authority for every calculated figure, including
 * discount_amount, premium_after_discount, tax_rate/tax_amount, and
 * premium_including_tax — none of these are recomputed on the frontend.
 * Only the requested discount_rate (a user input, not a result) and each tax
 * row's exemption flags are preserved from the current form state; every
 * other financial field is overwritten from `result` directly.
 */
export function applyRiskPremiumResult(
  row: QuotationRiskFormRow,
  result: RiskPremiumResult,
): QuotationRiskFormRow {
  const isZeroRate = result.percentage_rate === 0;

  const discounts =
    row.discounts_offered.length > 0
      ? row.discounts_offered.map((discount, discountIndex) =>
          discountIndex === 0
            ? {
                ...discount,
                discount_amount: String(result.discount_amount ?? 0),
              }
            : discount,
        )
      : row.discounts_offered;

  const taxes = applyChargesToTaxRows(row.taxes_charged, result.charges);

  return {
    ...row,
    sum_insured: isZeroRate ? '0' : row.sum_insured,
    sum_insured_equivalent: isZeroRate
      ? '0'
      : String(result.sum_insured_equivalent ?? result.sum_insured ?? 0),
    premium_rate: String(result.premium_rate ?? result.percentage_rate ?? 0),
    premium_before_discount: String(result.premium_before_discount ?? 0),
    discounts_offered: discounts,
    premium_after_discount: String(result.premium_after_discount ?? 0),
    premium_excluding_tax_equivalent: String(
      result.premium_excluding_tax_equivalent ?? 0,
    ),
    taxes_charged: taxes,
    premium_including_tax: String(result.premium_including_tax ?? 0),
    rating_result_metadata: {
      pricing_quote_id: result.pricing_quote_id ?? null,
      pricing_status: result.pricing_status ?? null,
      calculated_at: result.calculated_at ?? null,
      expires_at: result.expires_at ?? null,
      input_signature: result.input_signature ?? null,
      quotation_type: result.quotation_type ?? null,
      currency_code: result.currency_code ?? null,
      exchange_rate_snapshot: result.exchange_rate_snapshot ?? null,
      minimum_applied: result.minimum_premium_applied ?? result.minimum_applied,
      minimum_amount: result.minimum_premium ?? result.minimum_amount,
      discount_control: result.discount_control,
      loading_control: result.loading_control,
      discount_approval_required: result.discount_approval_required,
      loading_approval_required: result.loading_approval_required,
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
      exchange_rate_snapshot: result.exchange_rate_snapshot ?? null,
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
