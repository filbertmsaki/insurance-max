import Decimal from 'decimal.js';

export type DecimalLike = Decimal.Value;

Decimal.set({
  precision: 40,
  rounding: Decimal.ROUND_HALF_UP,
});

export const PRICING_DATABASE_PRECISION = {
  money: { precision: 20, scale: 4 },
  percentage: { precision: 18, scale: 10 },
  exchangeRate: { precision: 18, scale: 10 },
} as const;

export const PRICING_ROUNDING_POLICY = {
  premiumScale: 2,
  taxScale: 2,
  exchangeRateScale: 10,
  percentageScale: 10,
  perRiskScale: 2,
  quotationTotalScale: 2,
  moneyStorageScale: 4,
  componentRounding: 'ROUND_EACH_COMPONENT',
} as const;

export const PRICING_CALCULATION_SEQUENCE = [
  'VALIDATE_PRODUCT_AND_RISK',
  'VALIDATE_REQUIRED_RATING_FACTORS',
  'SELECT_APPLICABLE_RATING_RULE',
  'CALCULATE_RAW_BASE_PREMIUM',
  'APPLY_MINIMUM_AND_MAXIMUM_PREMIUM_RULES',
  'APPLY_OPTIONAL_COVERS',
  'APPLY_LOADINGS',
  'APPLY_AUTHORIZED_DISCOUNTS',
  'CALCULATE_TAXES_LEVIES_FEES_AND_CHARGES',
  'APPLY_CURRENCY_CONVERSION',
  'APPLY_CENTRALIZED_ROUNDING',
  'CALCULATE_FINAL_PAYABLE_PREMIUM',
  'SAVE_CALCULATION_BREAKDOWN',
] as const;

export function toDecimal(value: DecimalLike = 0): Decimal {
  if (value instanceof Decimal) {
    return value;
  }

  if (value === null || value === undefined || value === '') {
    return new Decimal(0);
  }

  return new Decimal(value);
}

function roundDecimal(value: DecimalLike, scale: number): Decimal {
  return toDecimal(value).toDecimalPlaces(scale, Decimal.ROUND_HALF_UP);
}

export function roundMoney(value: DecimalLike): number {
  return roundDecimal(value, PRICING_ROUNDING_POLICY.premiumScale).toNumber();
}

export function roundTax(value: DecimalLike): number {
  return roundDecimal(value, PRICING_ROUNDING_POLICY.taxScale).toNumber();
}

export function roundRate(value: DecimalLike): number {
  return roundDecimal(
    value,
    PRICING_ROUNDING_POLICY.percentageScale,
  ).toNumber();
}

export function roundExchangeRate(value: DecimalLike): number {
  return roundDecimal(
    value,
    PRICING_ROUNDING_POLICY.exchangeRateScale,
  ).toNumber();
}

export function normalizeMoneyForStorage(value: DecimalLike): string {
  return roundDecimal(value, PRICING_ROUNDING_POLICY.moneyStorageScale).toFixed(
    PRICING_ROUNDING_POLICY.moneyStorageScale,
  );
}

export function normalizeRateForStorage(value: DecimalLike): string {
  return roundDecimal(value, PRICING_ROUNDING_POLICY.percentageScale).toFixed(
    PRICING_ROUNDING_POLICY.percentageScale,
  );
}

export function normalizeExchangeRateForStorage(value: DecimalLike): string {
  return roundDecimal(value, PRICING_ROUNDING_POLICY.exchangeRateScale).toFixed(
    PRICING_ROUNDING_POLICY.exchangeRateScale,
  );
}

export function applyRate(amount: DecimalLike, rate: DecimalLike): Decimal {
  return toDecimal(amount).mul(toDecimal(rate));
}

export function sumDecimals(values: DecimalLike[]): Decimal {
  return values.reduce<Decimal>(
    (sum, value) => sum.plus(toDecimal(value)),
    new Decimal(0),
  );
}

export function moneyEqual(
  first: DecimalLike,
  second: DecimalLike,
  tolerance = 0.01,
): boolean {
  return toDecimal(first).minus(toDecimal(second)).abs().lte(tolerance);
}

export function numbersEqual(
  first: DecimalLike,
  second: DecimalLike,
  tolerance = 0.0000000001,
): boolean {
  return toDecimal(first).minus(toDecimal(second)).abs().lte(tolerance);
}

export function normalizeFractionalRate(
  value: DecimalLike,
  fieldName = 'rate',
): number {
  const rate = toDecimal(value);
  if (!rate.isFinite()) {
    throw new Error(`${fieldName} must be a valid decimal rate`);
  }
  if (rate.lt(0) || rate.gt(1)) {
    throw new Error(`${fieldName} must be between 0 and 1`);
  }
  return roundRate(rate);
}

export function displayPercentageFromRate(
  value: DecimalLike,
  scale = 6,
): number {
  return roundDecimal(toDecimal(value).mul(100), scale).toNumber();
}

export function rateFromDisplayPercentage(value: DecimalLike): number {
  return roundRate(toDecimal(value).div(100));
}
