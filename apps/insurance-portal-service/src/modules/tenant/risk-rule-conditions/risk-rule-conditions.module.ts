import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RiskRatingRulesModule } from '../risk-rating-rules/risk-rating-rules.module';
import { RiskRatingRule } from '../risk-rating-rules/entities/risk-rating-rule.entity';
import { RiskRuleConditionsController } from './risk-rule-conditions.controller';
import { RiskRuleConditionsService } from './risk-rule-conditions.service';
import { RiskRuleCondition } from './entities/risk-rule-condition.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([RiskRuleCondition, RiskRatingRule]),
    RiskRatingRulesModule,
  ],
  controllers: [RiskRuleConditionsController],
  providers: [RiskRuleConditionsService],
  exports: [RiskRuleConditionsService, TypeOrmModule],
})
export class RiskRuleConditionsModule {}
