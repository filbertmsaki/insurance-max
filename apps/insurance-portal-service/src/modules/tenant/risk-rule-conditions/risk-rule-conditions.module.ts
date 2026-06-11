import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RiskRatingRule } from '../risk-rating-rules/entities/risk-rating-rule.entity';
import { RiskRuleConditionsController } from './risk-rule-conditions.controller';
import { RiskRuleConditionsService } from './risk-rule-conditions.service';
import { RiskRuleCondition } from './entities/risk-rule-condition.entity';

@Module({
  imports: [TypeOrmModule.forFeature([RiskRuleCondition, RiskRatingRule])],
  controllers: [RiskRuleConditionsController],
  providers: [RiskRuleConditionsService],
  exports: [RiskRuleConditionsService, TypeOrmModule],
})
export class RiskRuleConditionsModule {}
