import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PricingRuntimeCacheModule } from '../pricing/pricing-runtime-cache.module';
import { RatingFactorsController } from './rating-factors.controller';
import { RatingFactorsService } from './rating-factors.service';
import { RatingFactor } from './entities/rating-factor.entity';

@Module({
  imports: [
    PricingRuntimeCacheModule,
    TypeOrmModule.forFeature([RatingFactor]),
  ],
  controllers: [RatingFactorsController],
  providers: [RatingFactorsService],
  exports: [RatingFactorsService, TypeOrmModule],
})
export class RatingFactorsModule {}
