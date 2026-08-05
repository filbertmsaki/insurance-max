import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CompanyUser } from '../../platform/companies/entities/company-user.entity';
import { BranchUser } from '../../tenant/branches/entities/branch-user.entity';
import { DepartmentUser } from '../../tenant/departments/entities/department-user.entity';
import { TiramisCompanyConfigurationEntity } from '../../tiramis/entities/tiramis-company-configuration.entity';
import { TiramisSalePointEntity } from '../../tiramis/entities/tiramis-sale-point.entity';

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
    ]),
  ],
  controllers: [OrganizationController],
  providers: [OrganizationContextService],
  exports: [OrganizationContextService],
})
export class OrganizationModule {}
