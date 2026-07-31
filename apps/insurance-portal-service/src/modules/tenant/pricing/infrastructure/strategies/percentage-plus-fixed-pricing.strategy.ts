import { Injectable } from '@nestjs/common';
import { RateType } from '@insurance-max/portal-shared/enums/rate-type.enum';
import type {
  PricingCalculationContext,
  PricingCalculatorStrategy,
} from '../../domain/pricing-calculator.types';

@Injectable()
export class PercentagePlusFixedPricingStrategy implements PricingCalculatorStrategy {
  readonly rateType = RateType.PERCENTAGE_PLUS_FIXED;

  calculate(context: PricingCalculationContext) {
    return context.basePremium.plus(context.fixedAmount);
  }
}
