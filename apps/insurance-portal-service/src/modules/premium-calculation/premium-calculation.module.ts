import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InsuranceRisk } from '../insurance-risks/entities/insurance-risk.entity';
import { RiskRequiredFactor } from '../risk-required-factors/entities/risk-required-factor.entity';
import { RiskRatingRule } from '../risk-rating-rules/entities/risk-rating-rule.entity';
import { PremiumCalculationController } from './premium-calculation.controller';
import { PremiumCalculationService } from './premium-calculation.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InsuranceRisk,
      RiskRequiredFactor,
      RiskRatingRule,
    ]),
  ],
  controllers: [PremiumCalculationController],
  providers: [PremiumCalculationService],
  exports: [PremiumCalculationService],
})
export class PremiumCalculationModule {}
