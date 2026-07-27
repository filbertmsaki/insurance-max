import { ConflictException, Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import { RateType } from '@insurance-max/portal-shared/enums/rate-type.enum';
import type {
  PricingCalculationContext,
  PricingCalculatorStrategy,
} from '../domain/pricing-calculator.types';
import { FixedPricingStrategy } from './strategies/fixed-pricing.strategy';
import { PercentagePricingStrategy } from './strategies/percentage-pricing.strategy';
import { PercentagePlusFixedPricingStrategy } from './strategies/percentage-plus-fixed-pricing.strategy';
import { PercentagePlusPerUnitPricingStrategy } from './strategies/percentage-plus-per-unit-pricing.strategy';
import { PerUnitPricingStrategy } from './strategies/per-unit-pricing.strategy';

@Injectable()
export class StructuredPricingCalculatorService {
  private readonly strategies = new Map<RateType, PricingCalculatorStrategy>();

  constructor(
    percentagePricingStrategy: PercentagePricingStrategy,
    fixedPricingStrategy: FixedPricingStrategy,
    percentagePlusFixedPricingStrategy: PercentagePlusFixedPricingStrategy,
    perUnitPricingStrategy: PerUnitPricingStrategy,
    percentagePlusPerUnitPricingStrategy: PercentagePlusPerUnitPricingStrategy,
  ) {
    [
      percentagePricingStrategy,
      fixedPricingStrategy,
      percentagePlusFixedPricingStrategy,
      perUnitPricingStrategy,
      percentagePlusPerUnitPricingStrategy,
    ].forEach((strategy) => {
      this.strategies.set(strategy.rateType, strategy);
    });
  }

  calculateGrossPremium(
    rateType: RateType,
    context: PricingCalculationContext,
    formulaText?: string | null,
  ): Decimal {
    const strategy = this.strategies.get(rateType);
    if (strategy) {
      return strategy.calculate(context);
    }

    if (rateType === RateType.FORMULA) {
      throw new ConflictException(
        [
          'Unsupported legacy FORMULA rule configuration.',
          'Free-text JavaScript formulas are no longer executable.',
          formulaText?.trim()
            ? `Unsupported formula: ${formulaText.trim()}`
            : 'No structured formula pattern could be resolved.',
        ].join(' '),
      );
    }

    throw new ConflictException(`Unsupported rate type: ${rateType}`);
  }
}
