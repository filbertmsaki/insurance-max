// For risk-level taxes (RiskRow.tsx), tax_rate/tax_amount are never sourced
// from here — the backend pricing engine is the sole authority (from the
// product's configured ProductTaxRule rows). This list only supplies the
// codes/labels for that selection UI; selecting a code clears
// tax_rate/tax_amount and lets the next calculation populate the real,
// backend-computed values.
//
// `rate` below exists solely for cover-note ADD-ONS (AddonRow.tsx), which
// have no backend pricing-engine involvement at all today (no add-on
// catalog/rate authority exists yet — a known, separately-tracked gap, not
// something this lookup should be mistaken for fixing).
export const TAX_CODE_OPTIONS = [
  { value: 'VAT-MAINLAND', label: 'VAT-MAINLAND', rate: '0.18' },
  { value: 'WITHHOLDING', label: 'WITHHOLDING', rate: '0.01' },
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

/** Add-on-only: there is no backend rate authority for cover-note add-ons yet. */
export function getTaxRateForCode(taxCode: string | null | undefined) {
  return (
    TAX_CODE_OPTIONS.find((option) => option.value === taxCode)?.rate ?? ''
  );
}

export function isSupportedTaxCode(
  taxCode: string | null | undefined,
): taxCode is SupportedTaxCode {
  return TAX_CODE_OPTIONS.some((option) => option.value === taxCode);
}
