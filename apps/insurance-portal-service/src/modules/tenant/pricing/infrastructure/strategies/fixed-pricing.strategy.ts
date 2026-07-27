import { Injectable } from '@nestjs/common';
import { RateType } from '@insurance-max/portal-shared/enums/rate-type.enum';
import type {
  PricingCalculationContext,
  PricingCalculatorStrategy,
} from '../../domain/pricing-calculator.types';

@Injectable()
export class FixedPricingStrategy implements PricingCalculatorStrategy {
  readonly rateType = RateType.FIXED;

  calculate(context: PricingCalculationContext) {
    return context.fixedAmount;
  }
}
