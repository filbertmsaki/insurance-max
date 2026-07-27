import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InsuranceRisk } from '../insurance-risks/entities/insurance-risk.entity';
import { PricingRuntimeCacheModule } from '../pricing/pricing-runtime-cache.module';
import { RatingFactor } from '../rating-factors/entities/rating-factor.entity';
import { RiskRequiredFactorsController } from './risk-required-factors.controller';
import { RiskRequiredFactorsService } from './risk-required-factors.service';
import { RiskRequiredFactor } from './entities/risk-required-factor.entity';

@Module({
  imports: [
    PricingRuntimeCacheModule,
    TypeOrmModule.forFeature([RiskRequiredFactor, InsuranceRisk, RatingFactor]),
  ],
  controllers: [RiskRequiredFactorsController],
  providers: [RiskRequiredFactorsService],
  exports: [RiskRequiredFactorsService, TypeOrmModule],
})
export class RiskRequiredFactorsModule {}
