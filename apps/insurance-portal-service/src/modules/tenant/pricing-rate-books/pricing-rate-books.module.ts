import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InsuranceProductVersion } from '../insurance-products/entities/insurance-product-version.entity';
import { ProductAddonDefinition } from '../insurance-products/entities/product-addon-definition.entity';
import { PricingRuntimeCacheModule } from '../pricing/pricing-runtime-cache.module';
import { RiskRuleCondition } from '../risk-rule-conditions/entities/risk-rule-condition.entity';
import { RiskRatingRule } from '../risk-rating-rules/entities/risk-rating-rule.entity';
import { ProductAddonRateRule } from '../pricing/entities/product-addon-rate-rule.entity';
import { PricingRateBooksController } from './pricing-rate-books.controller';
import { PricingRateBooksService } from './pricing-rate-books.service';
import { PricingRateBookEditabilityService } from './pricing-rate-book-editability.service';
import { PricingRateBookValidationService } from './pricing-rate-book-validation.service';
import { PricingRateBook } from './entities/pricing-rate-book.entity';

@Module({
  imports: [
    PricingRuntimeCacheModule,
    TypeOrmModule.forFeature([
      PricingRateBook,
      InsuranceProductVersion,
      RiskRatingRule,
      RiskRuleCondition,
      ProductAddonRateRule,
      ProductAddonDefinition,
    ]),
  ],
  controllers: [PricingRateBooksController],
  providers: [
    PricingRateBooksService,
    PricingRateBookEditabilityService,
    PricingRateBookValidationService,
  ],
  exports: [
    PricingRateBooksService,
    PricingRateBookEditabilityService,
    PricingRateBookValidationService,
    TypeOrmModule,
  ],
})
export class PricingRateBooksModule {}
