import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Permission } from '../permissions/entities/permission.entity';
import { Role } from '../roles/entities/role.entity';
import { User } from '../../tenant/users/entities/user.entity';
import { Company } from './entities/company.entity';
import { CompanyUser } from './entities/company-user.entity';
import { CompanyUserPermission } from './entities/company-user-permission.entity';
import { CompanyUserRole } from './entities/company-user-role.entity';
import { CompaniesService } from './companies.service';
import { CompaniesController } from './companies.controller';
import { IdentifierGeneratorService } from '../../shared/identifiers/identifier-generator.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Company,
      CompanyUser,
      CompanyUserRole,
      CompanyUserPermission,
      User,
      Role,
      Permission,
    ]),
  ],
  controllers: [CompaniesController],
  providers: [CompaniesService, IdentifierGeneratorService],
  exports: [CompaniesService, TypeOrmModule],
})
export class CompaniesModule {}
