import { Module } from '@nestjs/common';

import { BillingCommissionModule } from './billing-commission/billing-commission.module';
import { BranchesModule } from './branches/branches.module';
import { CategoryAccessModule } from './category-access/category-access.module';
import { CustomersModule } from './customers/customers.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { DepartmentsModule } from './departments/departments.module';
import { InsuranceCategoriesModule } from './insurance-categories/insurance-categories.module';
import { InsurancePartnersModule } from './insurance-partners/insurance-partners.module';
import { InsuranceProductsModule } from './insurance-products/insurance-products.module';
import { InsuranceRisksModule } from './insurance-risks/insurance-risks.module';
import { InsuranceSubClassesModule } from './insurance-sub-classes/insurance-sub-classes.module';
import { MotorModule } from './motor/motor.module';
import { NonMotorModule } from './non-motor/non-motor.module';
import { PoliciesModule } from './policies/policies.module';
import { PremiumCalculationModule } from './premium-calculation/premium-calculation.module';
import { PricingModule } from './pricing/pricing.module';
import { PricingRateBooksModule } from './pricing-rate-books/pricing-rate-books.module';
import { ProductAccessModule } from './product-access/product-access.module';
import { ProductDistributionModule } from './product-distribution/product-distribution.module';
import { QuotationsModule } from './quotations/quotations.module';
import { RatingFactorsModule } from './rating-factors/rating-factors.module';
import { RiskRatingRulesModule } from './risk-rating-rules/risk-rating-rules.module';
import { RiskRequiredFactorsModule } from './risk-required-factors/risk-required-factors.module';
import { RiskRuleConditionsModule } from './risk-rule-conditions/risk-rule-conditions.module';
import { TiramisIntegrationModule } from './tiramis-integration/tiramis-integration.module';
import { UsersModule } from './users/users.module';
import { VerificationsModule } from './verifications/verifications.module';

@Module({
  imports: [
    UsersModule,
    CustomersModule,
    DashboardModule,
    BranchesModule,
    DepartmentsModule,
    InsuranceCategoriesModule,
    InsuranceProductsModule,
    InsuranceSubClassesModule,
    InsuranceRisksModule,
    InsurancePartnersModule,
    ProductDistributionModule,
    QuotationsModule,
    MotorModule,
    NonMotorModule,
    PoliciesModule,
    PricingModule,
    PricingRateBooksModule,
    BillingCommissionModule,
    RatingFactorsModule,
    RiskRequiredFactorsModule,
    RiskRatingRulesModule,
    RiskRuleConditionsModule,
    CategoryAccessModule,
    ProductAccessModule,
    PremiumCalculationModule,
    TiramisIntegrationModule,
    VerificationsModule,
  ],
  exports: [
    UsersModule,
    CustomersModule,
    DashboardModule,
    BranchesModule,
    DepartmentsModule,
    InsuranceCategoriesModule,
    InsuranceProductsModule,
    InsuranceSubClassesModule,
    InsuranceRisksModule,
    InsurancePartnersModule,
    ProductDistributionModule,
    QuotationsModule,
    MotorModule,
    NonMotorModule,
    PoliciesModule,
    PricingModule,
    PricingRateBooksModule,
    BillingCommissionModule,
    RatingFactorsModule,
    RiskRequiredFactorsModule,
    RiskRatingRulesModule,
    RiskRuleConditionsModule,
    CategoryAccessModule,
    ProductAccessModule,
    PremiumCalculationModule,
    TiramisIntegrationModule,
    VerificationsModule,
  ],
})
export class TenantModule {}
