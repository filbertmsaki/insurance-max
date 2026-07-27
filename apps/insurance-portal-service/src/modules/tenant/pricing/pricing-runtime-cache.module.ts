import { Module } from '@nestjs/common';
import { RedisModule } from '../../shared/redis/redis.module';
import { PricingRuntimeCacheService } from './application/pricing-runtime-cache.service';

@Module({
  imports: [RedisModule],
  providers: [PricingRuntimeCacheService],
  exports: [PricingRuntimeCacheService],
})
export class PricingRuntimeCacheModule {}
