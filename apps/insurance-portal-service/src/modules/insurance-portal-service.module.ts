import { Module } from '@nestjs/common';

import { ApiClientsModule } from './api-clients/api-clients.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { BranchesModule } from './branches/branches.module';
import { CategoryAccessModule } from './category-access/category-access.module';
import { CompaniesModule } from './companies/companies.module';
import { DepartmentsModule } from './departments/departments.module';
import { DevicesModule } from './devices/devices.module';
import { InsuranceCategoriesModule } from './insurance-categories/insurance-categories.module';
import { InsuranceProductsModule } from './insurance-products/insurance-products.module';
import { InsuranceRisksModule } from './insurance-risks/insurance-risks.module';
import { InsuranceSubClassesModule } from './insurance-sub-classes/insurance-sub-classes.module';
import { MailModule } from './mail/mail.module';
import { OtpModule } from './otp/otp.module';
import { PermissionsModule } from './permissions/permissions.module';
import { PremiumCalculationModule } from './premium-calculation/premium-calculation.module';
import { ProductAccessModule } from './product-access/product-access.module';
import { RatingFactorsModule } from './rating-factors/rating-factors.module';
import { RedisModule } from './redis/redis.module';
import { RiskRatingRulesModule } from './risk-rating-rules/risk-rating-rules.module';
import { RiskRequiredFactorsModule } from './risk-required-factors/risk-required-factors.module';
import { RiskRuleConditionsModule } from './risk-rule-conditions/risk-rule-conditions.module';
import { RolesModule } from './roles/roles.module';
import { SessionsModule } from './sessions/sessions.module';
import { UserRolesModule } from './user-roles/user-roles.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    RedisModule,
    AuditModule,
    AuthModule,
    UsersModule,
    CompaniesModule,
    RolesModule,
    PermissionsModule,
    UserRolesModule,
    MailModule,
    OtpModule,
    SessionsModule,
    DevicesModule,
    ApiClientsModule,
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
export class InsurancePortalServiceModule {}
