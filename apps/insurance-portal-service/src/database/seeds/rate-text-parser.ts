import { RateType } from '@insurance-max/portal-shared/enums/rate-type.enum';

export interface ParsedRateText {
  rateType: RateType;
  percentageRate: number | null;
  fixedAmount: number | null;
  perUnitAmount: number | null;
  perUnitFactorCode: string | null;
}

export function normalizeFactorCode(raw: string | null): string | null {
  if (!raw) return null;

  const normalized = raw.trim().toLowerCase();
  if (!normalized) return null;

  if (normalized.includes('seat')) return 'seat_capacity';
  if (normalized.includes('weight') && normalized.includes('vehicle')) {
    return 'vehicle_weight_kg';
  }
  if (normalized.includes('ton')) return 'cargo_weight_ton';

  return normalized.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

export function parseAmount(raw: string): number {
  const parsed = Number(raw.replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function extractPercentagePlusTpp(
  rateText: string,
): { percentageRate: number } | null {
  // TIRA sheets sometimes express a rate as e.g. "2%+TPP" (Third Party
  // Property), where the added charge has no numeric literal in the rate
  // text itself - its amount is carried in the row's minimum_amount column
  // instead (see parseRateText's minimumAmount param).
  const match = rateText.match(/^([\d.]+)\s*%\s*\+\s*tpp$/i);
  if (!match) {
    return null;
  }
  return { percentageRate: Number(match[1]) };
}

function extractPercentagePlusPerUnit(rateText: string): {
  percentageRate: number;
  perUnitAmount: number;
  perUnitFactorCode: string | null;
} | null {
  const match = rateText.match(
    /^([\d.]+)\s*%\s*\+\s*(?:tzs|tshs?|tsh\.?)?\s*([\d,]+(?:\.\d+)?)\s*per\s+([a-z_ ]+)$/i,
  );
  if (!match) {
    return null;
  }

  return {
    percentageRate: Number(match[1]),
    perUnitAmount: parseAmount(match[2]),
    perUnitFactorCode: normalizeFactorCode(match[3]),
  };
}

function extractPercentagePlusFixed(rateText: string): {
  percentageRate: number;
  fixedAmount: number;
} | null {
  const match = rateText.match(
    /^([\d.]+)\s*%\s*\+\s*(?:tzs|tshs?|tsh\.?)?\s*([\d,]+(?:\.\d+)?)$/i,
  );
  if (!match) {
    return null;
  }

  return {
    percentageRate: Number(match[1]),
    fixedAmount: parseAmount(match[2]),
  };
}

function extractPerUnitOnly(rateText: string): {
  perUnitAmount: number;
  perUnitFactorCode: string | null;
} | null {
  const match = rateText.match(
    /^(?:tzs|tshs?|tsh\.?)?\s*([\d,]+(?:\.\d+)?)\s*per\s+([a-z_ ]+)$/i,
  );
  if (!match) {
    return null;
  }

  return {
    perUnitAmount: parseAmount(match[1]),
    perUnitFactorCode: normalizeFactorCode(match[2]),
  };
}

function extractPercentageOnly(rateText: string): number | null {
  const match = rateText.match(/^([\d.]+)\s*%$/i);
  if (!match) {
    return null;
  }

  return Number(match[1]);
}

function extractFixedOnly(rateText: string): number | null {
  const match = rateText.match(/^(?:tzs|tshs?|tsh\.?)?\s*([\d,]+(?:\.\d+)?)$/i);
  if (!match) {
    return null;
  }

  return parseAmount(match[1]);
}

/**
 * Parses a TIRA rate-sheet rate string (e.g. "5.5%+15,000 per seat",
 * "2%+TPP", "4%", "Tzs.150,000") into a structured rate. This is the single
 * source of truth for rate-text classification — used both by the seed
 * importer (002-product-engine.seed.ts, to classify a rule the first time
 * it's loaded) and by the rate-parsing audit script (scripts/audit-rate-parsing.ts,
 * to re-check already-seeded rows against this same chain) — so the two can
 * never drift the way the seeder's chain and premium-calculation.service.ts's
 * `resolveEffectiveRule` formula re-parser already have.
 *
 * Returns null if no branch in the chain recognizes the text at all (callers
 * typically fall back to RateType.FORMULA in that case).
 *
 * `minimumAmount` is only consulted for the "%+TPP" case, where TIRA's sheet
 * carries the additive charge in the minimum_amount column instead of the
 * rate text itself.
 */
export function parseRateText(
  rateText: string,
  minimumAmount: number | null,
): ParsedRateText | null {
  const text = rateText.trim();
  if (!text) return null;

  const percentagePlusTpp = extractPercentagePlusTpp(text);
  if (percentagePlusTpp) {
    return {
      rateType: RateType.PERCENTAGE_PLUS_FIXED,
      percentageRate: percentagePlusTpp.percentageRate,
      fixedAmount: minimumAmount ?? 0,
      perUnitAmount: null,
      perUnitFactorCode: null,
    };
  }

  const percentagePlusPerUnit = extractPercentagePlusPerUnit(text);
  if (percentagePlusPerUnit) {
    return {
      rateType: RateType.PERCENTAGE_PLUS_PER_UNIT,
      percentageRate: percentagePlusPerUnit.percentageRate,
      fixedAmount: null,
      perUnitAmount: percentagePlusPerUnit.perUnitAmount,
      perUnitFactorCode: percentagePlusPerUnit.perUnitFactorCode,
    };
  }

  const percentagePlusFixed = extractPercentagePlusFixed(text);
  if (percentagePlusFixed) {
    return {
      rateType: RateType.PERCENTAGE_PLUS_FIXED,
      percentageRate: percentagePlusFixed.percentageRate,
      fixedAmount: percentagePlusFixed.fixedAmount,
      perUnitAmount: null,
      perUnitFactorCode: null,
    };
  }

  const perUnitOnly = extractPerUnitOnly(text);
  if (perUnitOnly) {
    return {
      rateType: RateType.PER_UNIT,
      percentageRate: null,
      fixedAmount: null,
      perUnitAmount: perUnitOnly.perUnitAmount,
      perUnitFactorCode: perUnitOnly.perUnitFactorCode,
    };
  }

  const percentageOnly = extractPercentageOnly(text);
  if (percentageOnly !== null) {
    return {
      rateType: RateType.PERCENTAGE,
      percentageRate: percentageOnly,
      fixedAmount: null,
      perUnitAmount: null,
      perUnitFactorCode: null,
    };
  }

  const fixedOnly = extractFixedOnly(text);
  if (fixedOnly !== null) {
    return {
      rateType: RateType.FIXED,
      percentageRate: null,
      fixedAmount: fixedOnly,
      perUnitAmount: null,
      perUnitFactorCode: null,
    };
  }

  return null;
}
