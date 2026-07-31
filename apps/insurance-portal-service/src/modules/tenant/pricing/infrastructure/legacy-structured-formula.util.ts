export interface LegacyStructuredFormulaMatch {
  kind: 'PERCENTAGE_PLUS_PER_UNIT' | 'PER_UNIT' | 'PERCENTAGE_PLUS_FIXED';
  percentageRateText?: string;
  fixedAmountText?: string;
  perUnitAmountText?: string;
  perUnitFactorLabel?: string;
}

export function matchLegacyStructuredFormula(
  formulaText: string,
): LegacyStructuredFormulaMatch | null {
  const normalized = formulaText.trim();
  if (!normalized) {
    return null;
  }

  const percentagePlusPerUnit = normalized.match(
    /^([\d.]+)\s*%\s*\+\s*(?:tzs|tshs?|tsh\.?)?\s*([\d,]+(?:\.\d+)?)\s*per\s+([a-z_ ]+)$/i,
  );
  if (percentagePlusPerUnit) {
    return {
      kind: 'PERCENTAGE_PLUS_PER_UNIT',
      percentageRateText: percentagePlusPerUnit[1],
      perUnitAmountText: percentagePlusPerUnit[2],
      perUnitFactorLabel: percentagePlusPerUnit[3],
    };
  }

  const perUnitOnly = normalized.match(
    /^(?:tzs|tshs?|tsh\.?)?\s*([\d,]+(?:\.\d+)?)\s*per\s+([a-z_ ]+)$/i,
  );
  if (perUnitOnly) {
    return {
      kind: 'PER_UNIT',
      perUnitAmountText: perUnitOnly[1],
      perUnitFactorLabel: perUnitOnly[2],
    };
  }

  const percentagePlusFixed = normalized.match(
    /^([\d.]+)\s*%\s*\+\s*(?:tzs|tshs?|tsh\.?)?\s*([\d,]+(?:\.\d+)?)$/i,
  );
  if (percentagePlusFixed) {
    return {
      kind: 'PERCENTAGE_PLUS_FIXED',
      percentageRateText: percentagePlusFixed[1],
      fixedAmountText: percentagePlusFixed[2],
    };
  }

  return null;
}

export function isSupportedLegacyStructuredFormula(
  formulaText: string | null | undefined,
): boolean {
  if (!formulaText?.trim()) {
    return false;
  }

  return matchLegacyStructuredFormula(formulaText) !== null;
}
