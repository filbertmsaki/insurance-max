import { Module } from '@nestjs/common';

import { BranchesModule } from './branches/branches.module';
import { CategoryAccessModule } from './category-access/category-access.module';
import { DepartmentsModule } from './departments/departments.module';
import { InsuranceCategoriesModule } from './insurance-categories/insurance-categories.module';
import { InsuranceProductsModule } from './insurance-products/insurance-products.module';
import { InsuranceRisksModule } from './insurance-risks/insurance-risks.module';
import { InsuranceSubClassesModule } from './insurance-sub-classes/insurance-sub-classes.module';
import { PremiumCalculationModule } from './premium-calculation/premium-calculation.module';
import { ProductAccessModule } from './product-access/product-access.module';
import { RatingFactorsModule } from './rating-factors/rating-factors.module';
import { RiskRatingRulesModule } from './risk-rating-rules/risk-rating-rules.module';
import { RiskRequiredFactorsModule } from './risk-required-factors/risk-required-factors.module';
import { RiskRuleConditionsModule } from './risk-rule-conditions/risk-rule-conditions.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    UsersModule,
    BranchesModule,
    DepartmentsModule,
    InsuranceCategoriesModule,
    InsuranceProductsModule,
    InsuranceSubClassesModule,
    InsuranceRisksModule,
    RatingFactorsModule,
    RiskRequiredFactorsModule,
    RiskRatingRulesModule,
    RiskRuleConditionsModule,
    CategoryAccessModule,
    ProductAccessModule,
    PremiumCalculationModule,
  ],
  exports: [
    UsersModule,
    BranchesModule,
    DepartmentsModule,
    InsuranceCategoriesModule,
    InsuranceProductsModule,
    InsuranceSubClassesModule,
    InsuranceRisksModule,
    RatingFactorsModule,
    RiskRequiredFactorsModule,
    RiskRatingRulesModule,
    RiskRuleConditionsModule,
    CategoryAccessModule,
    ProductAccessModule,
    PremiumCalculationModule,
  ],
})
export class TenantModule {}
