function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortValue(item));
  }

  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = sortValue((value as Record<string, unknown>)[key]);
        return result;
      }, {});
  }

  return value;
}

function normalizeRiskDiscounts(discounts: unknown) {
  if (!Array.isArray(discounts)) return discounts;

  return discounts.map((discount) => {
    if (!discount || typeof discount !== 'object') return discount;
    const row = discount as Record<string, unknown>;
    return {
      discount_type: row.discount_type ?? '',
      discount_rate: row.discount_rate ?? '',
    };
  });
}

function normalizeRiskTaxes(taxes: unknown) {
  if (!Array.isArray(taxes)) return taxes;

  return taxes.map((tax) => {
    if (!tax || typeof tax !== 'object') return tax;
    const row = tax as Record<string, unknown>;
    return {
      tax_code: row.tax_code ?? '',
      tax_rate: row.tax_rate ?? '',
      is_tax_exempted: row.is_tax_exempted ?? false,
      tax_exemption_type: row.tax_exemption_type ?? '',
      tax_exemption_reference: row.tax_exemption_reference ?? '',
    };
  });
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
  return buildQuotationPricingSignature({
    quotation_type: input.quotation_type,
    product_id: input.product_id,
    valid_from: input.valid_from,
    valid_until: input.valid_until,
    currency: input.currency,
    exchange_rate: input.exchange_rate,
    motor: input.motor,
    addons: input.addons,
    risk: {
      risk_id: input.risk.risk_id,
      risk_code: input.risk.risk_code,
      sum_insured: input.risk.sum_insured,
      factor_values: input.risk.factor_values,
      discounts_offered: normalizeRiskDiscounts(input.risk.discounts_offered),
      taxes_charged: normalizeRiskTaxes(input.risk.taxes_charged),
    },
  });
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
    factor_values?: unknown;
    discounts_offered?: unknown;
    taxes_charged?: unknown;
  };
}): string {
  return buildQuotationPricingSignature({
    quotation_type: input.quotation_type,
    product_id: input.product_id,
    valid_from: input.valid_from,
    valid_until: input.valid_until,
    currency: input.currency,
    exchange_rate: input.exchange_rate,
    // Only the fleet type can affect a vehicle's price. The shared cover is
    // already mirrored into the vehicle's own risk row, and the vehicle counts
    // are recounted after pricing, so including them would mark freshly
    // priced vehicles as stale.
    fleet_header: {
      fleet_type: (input.fleet_header as { fleet_type?: unknown } | undefined)
        ?.fleet_type,
    },
    item: {
      cover_note_addons: input.item.cover_note_addons,
      subject_matters_covered: input.item.subject_matters_covered,
      motor_dtl: input.item.motor_dtl,
    },
    risk: {
      risk_id: input.risk.risk_id,
      risk_code: input.risk.risk_code,
      sum_insured: input.risk.sum_insured,
      factor_values: input.risk.factor_values,
      discounts_offered: normalizeRiskDiscounts(input.risk.discounts_offered),
      taxes_charged: normalizeRiskTaxes(input.risk.taxes_charged),
    },
  });
}
