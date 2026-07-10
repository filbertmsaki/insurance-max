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

export function getTaxRateForCode(taxCode: string | null | undefined) {
  return TAX_CODE_OPTIONS.find((option) => option.value === taxCode)?.rate ?? '';
}

export function isSupportedTaxCode(
  taxCode: string | null | undefined,
): taxCode is SupportedTaxCode {
  return TAX_CODE_OPTIONS.some((option) => option.value === taxCode);
}
