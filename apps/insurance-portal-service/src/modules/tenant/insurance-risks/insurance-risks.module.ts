import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InsuranceProduct } from '../insurance-products/entities/insurance-product.entity';
import { PricingRuntimeCacheModule } from '../pricing/pricing-runtime-cache.module';
import { InsuranceSubClass } from '../insurance-sub-classes/entities/insurance-sub-class.entity';
import { RiskRequiredFactor } from '../risk-required-factors/entities/risk-required-factor.entity';
import { InsuranceRisksController } from './insurance-risks.controller';
import { InsuranceRisksService } from './insurance-risks.service';
import { InsuranceRisk } from './entities/insurance-risk.entity';

@Module({
  imports: [
    PricingRuntimeCacheModule,
    TypeOrmModule.forFeature([
      InsuranceRisk,
      InsuranceProduct,
      InsuranceSubClass,
      RiskRequiredFactor,
    ]),
  ],
  controllers: [InsuranceRisksController],
  providers: [InsuranceRisksService],
  exports: [InsuranceRisksService, TypeOrmModule],
})
export class InsuranceRisksModule {}
