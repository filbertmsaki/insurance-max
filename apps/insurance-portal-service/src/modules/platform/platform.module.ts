import { Module } from '@nestjs/common';

import { ApiClientsModule } from './api-clients/api-clients.module';
import { CompaniesModule } from './companies/companies.module';
import { CompanyConfigsModule } from './company-configs/company-configs.module';
import { PermissionsModule } from './permissions/permissions.module';
import { ReferenceDataModule } from './reference-data/reference-data.module';
import { RolesModule } from './roles/roles.module';
import { SaasBillingModule } from './saas-billing/saas-billing.module';
import { SystemConfigsModule } from './system-configs/system-configs.module';
import { PlatformIntelligenceModule } from './intelligence/platform-intelligence.module';

@Module({
  imports: [
    CompaniesModule,
    CompanyConfigsModule,
    RolesModule,
    PermissionsModule,
    ApiClientsModule,
    ReferenceDataModule,
    SaasBillingModule,
    SystemConfigsModule,
    PlatformIntelligenceModule,
  ],
  exports: [
    CompaniesModule,
    CompanyConfigsModule,
    RolesModule,
    PermissionsModule,
    ApiClientsModule,
    ReferenceDataModule,
    SaasBillingModule,
    SystemConfigsModule,
    PlatformIntelligenceModule,
  ],
})
export class PlatformModule {}
