import { Module } from '@nestjs/common';

import { ApiClientsModule } from './api-clients/api-clients.module';
import { CompaniesModule } from './companies/companies.module';
import { PermissionsModule } from './permissions/permissions.module';
import { RolesModule } from './roles/roles.module';
import { SaasBillingModule } from './saas-billing/saas-billing.module';
import { PlatformIntelligenceModule } from './intelligence/platform-intelligence.module';

@Module({
  imports: [
    CompaniesModule,
    RolesModule,
    PermissionsModule,
    ApiClientsModule,
    SaasBillingModule,
    PlatformIntelligenceModule,
  ],
  exports: [
    CompaniesModule,
    RolesModule,
    PermissionsModule,
    ApiClientsModule,
    SaasBillingModule,
    PlatformIntelligenceModule,
  ],
})
export class PlatformModule {}
