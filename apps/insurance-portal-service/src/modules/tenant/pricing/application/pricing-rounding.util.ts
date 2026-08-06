import Decimal from 'decimal.js';
import { PricingRoundingMode } from '@insurance-max/contracts';
import { roundMoney } from '@insurance-max/portal-shared/utils/pricing-calculation.util';

const ROUNDING_MODE_MAP: Record<PricingRoundingMode, Decimal.Rounding> = {
  [PricingRoundingMode.HALF_UP]: Decimal.ROUND_HALF_UP,
  [PricingRoundingMode.UP]: Decimal.ROUND_UP,
  [PricingRoundingMode.DOWN]: Decimal.ROUND_DOWN,
};

/**
 * Applies the rate book's own rounding policy (mode + increment) to the
 * final payable premium. Every earlier intermediate rounding step in the
 * calculation keeps using the global `roundMoney()` HALF_UP-to-2dp policy —
 * this helper is wired in ONLY at the very last rounding step of
 * PricingEngineService.calculateSingleRisk().
 */
export function roundToIncrement(
  value: Decimal,
  incrementStr: string,
  mode: PricingRoundingMode,
): Decimal {
  const increment = new Decimal(incrementStr || '0');
  if (increment.lte(0)) {
    return new Decimal(roundMoney(value));
  }

  const roundingMode = ROUNDING_MODE_MAP[mode] ?? Decimal.ROUND_HALF_UP;

  return value
    .div(increment)
    .toDecimalPlaces(0, roundingMode)
    .mul(increment)
    .toDecimalPlaces(4, roundingMode);
}
