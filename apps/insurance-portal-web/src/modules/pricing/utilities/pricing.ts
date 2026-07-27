import type { PricingFactorValues, PricingQuoteMetadata } from '../types/pricing';

export function resolvePricingSumInsured(factors: PricingFactorValues): number {
  const raw = factors.sum_insured ?? factors.sum_insured_amount ?? 0;
  const numeric = Number(raw);

  return Number.isFinite(numeric) && numeric >= 0 ? numeric : 0;
}

export function formatPricingMoney(value: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatPricingDate(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toLocaleString();
}

export function formatDisplayRatePercent(rate: number): string {
  return (rate * 100).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  });
}

export function isPricingQuoteExpired(
  metadata: PricingQuoteMetadata | null | undefined,
  now = Date.now(),
): boolean {
  if (!metadata?.expires_at) {
    return false;
  }

  const expiresAt = Date.parse(metadata.expires_at);
  if (Number.isNaN(expiresAt)) {
    return false;
  }

  return expiresAt <= now;
}

export function isPricingQuoteStale(
  metadata: PricingQuoteMetadata | null | undefined,
): boolean {
  return metadata?.pricing_is_stale === true;
}

export function hasPricingValidationErrors(
  metadata: PricingQuoteMetadata | null | undefined,
): boolean {
  return (metadata?.validation_errors?.length ?? 0) > 0;
}

export function hasPricingValidationWarnings(
  metadata: PricingQuoteMetadata | null | undefined,
): boolean {
  return (metadata?.validation_warnings?.length ?? 0) > 0;
}
