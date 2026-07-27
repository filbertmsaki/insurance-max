import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RatingFactor } from '../rating-factors/entities/rating-factor.entity';
import { InsuranceRisk } from '../insurance-risks/entities/insurance-risk.entity';
import { PricingRateBook } from '../pricing-rate-books/entities/pricing-rate-book.entity';
import { RiskRuleCondition } from '../risk-rule-conditions/entities/risk-rule-condition.entity';
import { RiskRatingRulesController } from './risk-rating-rules.controller';
import { RiskRatingRuleConfigurationValidatorService } from './risk-rating-rule-configuration-validator.service';
import { RiskRatingRulesService } from './risk-rating-rules.service';
import { RiskRatingRule } from './entities/risk-rating-rule.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RiskRatingRule,
      InsuranceRisk,
      RiskRuleCondition,
      RatingFactor,
      PricingRateBook,
    ]),
  ],
  controllers: [RiskRatingRulesController],
  providers: [
    RiskRatingRulesService,
    RiskRatingRuleConfigurationValidatorService,
  ],
  exports: [
    RiskRatingRulesService,
    RiskRatingRuleConfigurationValidatorService,
    TypeOrmModule,
  ],
})
export class RiskRatingRulesModule {}
