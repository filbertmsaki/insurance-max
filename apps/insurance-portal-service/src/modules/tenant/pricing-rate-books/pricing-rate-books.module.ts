import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InsuranceProduct } from '../insurance-products/entities/insurance-product.entity';
import { RiskRuleCondition } from '../risk-rule-conditions/entities/risk-rule-condition.entity';
import { RiskRatingRule } from '../risk-rating-rules/entities/risk-rating-rule.entity';
import { PricingRateBooksController } from './pricing-rate-books.controller';
import { PricingRateBooksService } from './pricing-rate-books.service';
import { PricingRateBook } from './entities/pricing-rate-book.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PricingRateBook,
      InsuranceProduct,
      RiskRatingRule,
      RiskRuleCondition,
    ]),
  ],
  controllers: [PricingRateBooksController],
  providers: [PricingRateBooksService],
  exports: [PricingRateBooksService, TypeOrmModule],
})
export class PricingRateBooksModule {}
