import Decimal from 'decimal.js';
import { RateType } from '@insurance-max/portal-shared/enums/rate-type.enum';

export interface PricingCalculationContext {
  sumInsured: Decimal;
  percentageRate: Decimal;
  fixedAmount: Decimal;
  perUnitAmount: Decimal;
  perUnitValue: Decimal;
  basePremium: Decimal;
  perUnitPremium: Decimal;
}

export interface PricingCalculatorStrategy {
  readonly rateType: RateType;
  calculate(context: PricingCalculationContext): Decimal;
}
