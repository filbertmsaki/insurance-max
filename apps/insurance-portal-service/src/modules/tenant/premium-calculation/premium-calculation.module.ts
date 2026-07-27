import { Module } from '@nestjs/common';
import { PricingModule } from '../pricing/pricing.module';
import { PremiumCalculationController } from './premium-calculation.controller';
import { PremiumCalculationService } from './premium-calculation.service';

@Module({
  imports: [PricingModule],
  controllers: [PremiumCalculationController],
  providers: [PremiumCalculationService],
  exports: [PremiumCalculationService],
})
export class PremiumCalculationModule {}
