// These defaults are stored as decimal fractions, e.g. 18% = 0.18.
// The backend pricing engine remains authoritative for risk-level charge
// amounts, but the wizard can still prefill the decimal rate to reduce manual
// entry and keep the UI aligned with the configured tax code.
export const TAX_CODE_OPTIONS = [
  { value: 'VAT-MAINLAND', label: 'VAT-MAINLAND', rate: '0.18' },
  { value: 'WITHHOLDING', label: 'WITHHOLDING', rate: '0.10' },
] as const;

export const DISCOUNT_TYPE_OPTIONS = [
  { value: '1', label: '1. Fleet discount', rate: '0.10' },
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
    DISCOUNT_TYPE_OPTIONS.find((option) => option.value === discountType)?.rate ??
    ''
  );
}

export function isSupportedTaxCode(
  taxCode: string | null | undefined,
): taxCode is SupportedTaxCode {
  return TAX_CODE_OPTIONS.some((option) => option.value === taxCode);
}
