import { Module } from '@nestjs/common';

import { ApiClientsModule } from './api-clients/api-clients.module';
import { CompaniesModule } from './companies/companies.module';
import { PermissionsModule } from './permissions/permissions.module';
import { RolesModule } from './roles/roles.module';

@Module({
  imports: [CompaniesModule, RolesModule, PermissionsModule, ApiClientsModule],
  exports: [CompaniesModule, RolesModule, PermissionsModule, ApiClientsModule],
})
export class PlatformModule {}
