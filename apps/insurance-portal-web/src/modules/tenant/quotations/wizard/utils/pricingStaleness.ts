function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortValue(item));
  }

  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = sortValue((value as Record<string, unknown>)[key]);
        return result;
      }, {});
  }

  return value;
}

export function buildQuotationPricingSignature(input: unknown): string {
  return JSON.stringify(sortValue(input));
}

export function buildSingleRiskPricingSignature(input: {
  quotation_type?: string;
  product_id?: string;
  valid_from?: string;
  valid_until?: string;
  currency?: string;
  exchange_rate?: string | number | null;
  motor?: unknown;
  addons?: unknown;
  risk: {
    risk_id?: string;
    risk_code?: string;
    sum_insured?: string | number;
    factor_values?: unknown;
    discounts_offered?: unknown;
    taxes_charged?: unknown;
  };
}): string {
  return buildQuotationPricingSignature(input);
}

export function buildFleetRiskPricingSignature(input: {
  quotation_type?: string;
  product_id?: string;
  valid_from?: string;
  valid_until?: string;
  currency?: string;
  exchange_rate?: string | number | null;
  fleet_header?: unknown;
  item: {
    cover_note_addons?: unknown;
    subject_matters_covered?: unknown;
    motor_dtl?: unknown;
  };
  risk: {
    risk_id?: string;
    risk_code?: string;
    sum_insured?: string | number;
    discounts_offered?: unknown;
    taxes_charged?: unknown;
  };
}): string {
  return buildQuotationPricingSignature(input);
}
