// These defaults are stored as decimal fractions, e.g. 18% = 0.18.
// The backend pricing engine remains authoritative for risk-level charge
// amounts, but the wizard can still prefill the decimal rate to reduce manual
// entry and keep the UI aligned with the configured tax code.
export const TAX_CODE_OPTIONS = [
  { value: 'VAT-MAINLAND', label: 'VAT-MAINLAND', rate: '0.18' },
  { value: 'WITHHOLDING', label: 'WITHHOLDING', rate: '0.10' },
] as const;

export const DISCOUNT_TYPE_OPTIONS = [
  { value: '1', label: 'Fleet discount', rate: '0.10' },
] as const;

export const TAX_EXEMPTION_OPTIONS = [
  { value: 'N', label: 'No' },
  { value: 'Y', label: 'Yes' },
] as const;

export const TAX_EXEMPTION_TYPE_OPTIONS = [
  { value: '1', label: '1. PolicyHolder exempted' },
  { value: '2', label: '2. Risk exempted' },
] as const;

export type SupportedTaxCode = (typeof TAX_CODE_OPTIONS)[number]['value'];
export type SupportedDiscountType =
  (typeof DISCOUNT_TYPE_OPTIONS)[number]['value'];

export function getTaxRateForCode(taxCode: string | null | undefined) {
  return (
    TAX_CODE_OPTIONS.find((option) => option.value === taxCode)?.rate ?? ''
  );
}

export function getDiscountRateForType(
  discountType: string | null | undefined,
) {
  return (
    DISCOUNT_TYPE_OPTIONS.find((option) => option.value === discountType)
      ?.rate ?? ''
  );
}

export function formatRatePercent(rate: string | number | null | undefined) {
  return Number((Number(rate ?? 0) * 100).toFixed(8));
}

export function formatDiscountOptionLabel(option: {
  label: string;
  rate: string;
}) {
  return `${option.label} (${formatRatePercent(option.rate)}%)`;
}

export function isSupportedTaxCode(
  taxCode: string | null | undefined,
): taxCode is SupportedTaxCode {
  return TAX_CODE_OPTIONS.some((option) => option.value === taxCode);
}

// ─── Tax-rule-sourced options (risk-level "Taxes Charged") ────────────────────
//
// Unlike TAX_CODE_OPTIONS above (a static fallback still used for the
// free-text add-on tax rows), a risk's own tax selector is sourced from the
// company's actually-configured ProductTaxRule records via
// GET /product-distribution/tax-rules/active, scoped to the risk's
// category/product/risk and effective date — see useActiveTaxRules.

export interface ActiveTaxRule {
  id: string;
  tax_code: string;
  tax_name: string;
  charge_category: string;
  tax_type: 'PERCENTAGE' | 'FIXED';
  tax_rate: string | null;
  category_id: string | null;
  product_id: string | null;
  risk_id: string | null;
  effective_from: string;
  effective_to: string;
  is_default?: boolean;
}

export interface TaxRuleOption {
  value: string;
  label: string;
  rate: string;
  isDefault?: boolean;
}

export function resolveTaxRuleOptions({
  rules,
  categoryId,
  productId,
  riskId,
  effectiveDate,
}: {
  rules: ActiveTaxRule[] | undefined;
  categoryId: string | null | undefined;
  productId: string | null | undefined;
  riskId: string | null | undefined;
  effectiveDate: string | null | undefined;
}): TaxRuleOption[] {
  const seenCodes = new Set<string>();
  const options: TaxRuleOption[] = [];

  for (const rule of rules ?? []) {
    if (rule.category_id && rule.category_id !== (categoryId || null)) {
      continue;
    }
    if (rule.product_id && rule.product_id !== (productId || null)) {
      continue;
    }
    if (rule.risk_id && rule.risk_id !== (riskId || null)) {
      continue;
    }
    if (
      effectiveDate &&
      (rule.effective_from > effectiveDate || rule.effective_to < effectiveDate)
    ) {
      continue;
    }
    if (seenCodes.has(rule.tax_code)) {
      continue;
    }

    seenCodes.add(rule.tax_code);
    options.push({
      value: rule.tax_code,
      label: `${rule.tax_name} (${rule.tax_code})`,
      rate: rule.tax_type === 'PERCENTAGE' ? (rule.tax_rate ?? '') : '',
      isDefault: rule.is_default === true,
    });
  }

  return options;
}
