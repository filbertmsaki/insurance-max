import { Injectable } from '@nestjs/common';
import { RateType } from '@insurance-max/portal-shared/enums/rate-type.enum';
import type {
  PricingCalculationContext,
  PricingCalculatorStrategy,
} from '../../domain/pricing-calculator.types';

@Injectable()
export class PercentagePlusPerUnitPricingStrategy implements PricingCalculatorStrategy {
  readonly rateType = RateType.PERCENTAGE_PLUS_PER_UNIT;

  calculate(context: PricingCalculationContext) {
    return context.basePremium.plus(context.perUnitPremium);
  }
}
