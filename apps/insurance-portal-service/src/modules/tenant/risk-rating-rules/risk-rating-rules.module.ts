import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InsuranceRisk } from '../insurance-risks/entities/insurance-risk.entity';
import { RiskRatingRulesController } from './risk-rating-rules.controller';
import { RiskRatingRulesService } from './risk-rating-rules.service';
import { RiskRatingRule } from './entities/risk-rating-rule.entity';

@Module({
  imports: [TypeOrmModule.forFeature([RiskRatingRule, InsuranceRisk])],
  controllers: [RiskRatingRulesController],
  providers: [RiskRatingRulesService],
  exports: [RiskRatingRulesService, TypeOrmModule],
})
export class RiskRatingRulesModule {}
