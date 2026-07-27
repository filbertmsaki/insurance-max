import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IdentifierGeneratorService } from '../../shared/identifiers/identifier-generator.service';
import { InsuranceRisk } from '../insurance-risks/entities/insurance-risk.entity';
import { PricingRateBook } from '../pricing-rate-books/entities/pricing-rate-book.entity';
import { ProductTaxRule } from '../product-distribution/entities/product-tax-rule.entity';
import { RatingFactor } from '../rating-factors/entities/rating-factor.entity';
import { RiskRequiredFactor } from '../risk-required-factors/entities/risk-required-factor.entity';
import { PricingChargeService } from './application/pricing-charge.service';
import { RiskRatingRule } from '../risk-rating-rules/entities/risk-rating-rule.entity';
import { PricingEngineService } from './application/pricing-engine.service';
import { PricingQuoteService } from './application/pricing-quote.service';
import { PricingValidationService } from './application/pricing-validation.service';
import { QuotationRecalculationService } from './application/quotation-recalculation.service';
import { PricingQuote } from './entities/pricing-quote.entity';
import { PremiumBreakdownService } from './infrastructure/premium-breakdown.service';
import { RatingFactorValidatorService } from './infrastructure/rating-factor-validator.service';
import { RatingRuleMatcherService } from './infrastructure/rating-rule-matcher.service';
import { StructuredPricingCalculatorService } from './infrastructure/structured-pricing-calculator.service';
import { FixedPricingStrategy } from './infrastructure/strategies/fixed-pricing.strategy';
import { PercentagePricingStrategy } from './infrastructure/strategies/percentage-pricing.strategy';
import { PercentagePlusFixedPricingStrategy } from './infrastructure/strategies/percentage-plus-fixed-pricing.strategy';
import { PercentagePlusPerUnitPricingStrategy } from './infrastructure/strategies/percentage-plus-per-unit-pricing.strategy';
import { PerUnitPricingStrategy } from './infrastructure/strategies/per-unit-pricing.strategy';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InsuranceRisk,
      PricingQuote,
      PricingRateBook,
      ProductTaxRule,
      RatingFactor,
      RiskRequiredFactor,
      RiskRatingRule,
    ]),
  ],
  providers: [
    PricingValidationService,
    RatingFactorValidatorService,
    RatingRuleMatcherService,
    IdentifierGeneratorService,
    PercentagePricingStrategy,
    FixedPricingStrategy,
    PercentagePlusFixedPricingStrategy,
    PerUnitPricingStrategy,
    PercentagePlusPerUnitPricingStrategy,
    StructuredPricingCalculatorService,
    PremiumBreakdownService,
    PricingChargeService,
    PricingEngineService,
    PricingQuoteService,
    QuotationRecalculationService,
  ],
  exports: [
    PricingValidationService,
    RatingFactorValidatorService,
    RatingRuleMatcherService,
    StructuredPricingCalculatorService,
    PremiumBreakdownService,
    PricingChargeService,
    PricingEngineService,
    PricingQuoteService,
    QuotationRecalculationService,
  ],
})
export class PricingModule {}
