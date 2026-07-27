import { Injectable } from '@nestjs/common';
import { RateType } from '@insurance-max/portal-shared/enums/rate-type.enum';
import type {
  PricingCalculationContext,
  PricingCalculatorStrategy,
} from '../../domain/pricing-calculator.types';

@Injectable()
export class PercentagePricingStrategy implements PricingCalculatorStrategy {
  readonly rateType = RateType.PERCENTAGE;

  calculate(context: PricingCalculationContext) {
    return context.basePremium;
  }
}
