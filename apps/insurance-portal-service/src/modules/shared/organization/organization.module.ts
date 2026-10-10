import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CompanyUser } from '../../platform/companies/entities/company-user.entity';
import { BranchUser } from '../../tenant/branches/entities/branch-user.entity';
import { DepartmentUser } from '../../tenant/departments/entities/department-user.entity';
import { TiramisCompanyConfigurationEntity } from '../../tiramis/entities/tiramis-company-configuration.entity';
import { TiramisSalePointEntity } from '../../tiramis/entities/tiramis-sale-point.entity';
import { TiramisCompanyLinkEntity } from '../../tiramis/entities/tiramis-company-link.entity';
import { TiramisPlatformSettingsEntity } from '../../tiramis/entities/tiramis-platform-settings.entity';
import { TiramisServiceApiKeyVaultService } from '../../tiramis/services/tiramis-service-api-key-vault.service';
import { TiramisPlatformAccessService } from './tiramis-platform-access.service';

import { OrganizationController } from './organization.controller';
import { OrganizationContextService } from './organization-context.service';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      CompanyUser,
      BranchUser,
      DepartmentUser,
      TiramisCompanyConfigurationEntity,
      TiramisSalePointEntity,
      TiramisCompanyLinkEntity,
      TiramisPlatformSettingsEntity,
    ]),
  ],
  controllers: [OrganizationController],
  providers: [
    OrganizationContextService,
    TiramisPlatformAccessService,
    TiramisServiceApiKeyVaultService,
  ],
  exports: [OrganizationContextService, TiramisPlatformAccessService],
})
export class OrganizationModule {}
