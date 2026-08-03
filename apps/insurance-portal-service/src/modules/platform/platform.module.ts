import { Module } from '@nestjs/common';

import { ApiClientsModule } from './api-clients/api-clients.module';
import { CompaniesModule } from './companies/companies.module';
import { PermissionsModule } from './permissions/permissions.module';
import { RolesModule } from './roles/roles.module';
import { SaasBillingModule } from './saas-billing/saas-billing.module';

@Module({
  imports: [
    CompaniesModule,
    RolesModule,
    PermissionsModule,
    ApiClientsModule,
    SaasBillingModule,
  ],
  exports: [
    CompaniesModule,
    RolesModule,
    PermissionsModule,
    ApiClientsModule,
    SaasBillingModule,
  ],
})
export class PlatformModule {}
