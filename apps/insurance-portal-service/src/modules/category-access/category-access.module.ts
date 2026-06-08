import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Branch } from '../branches/entities/branch.entity';
import { CompanyUser } from '../companies/entities/company-user.entity';
import { Department } from '../departments/entities/department.entity';
import { InsuranceCategory } from '../insurance-categories/entities/insurance-category.entity';
import { CategoryAccessController } from './category-access.controller';
import { CategoryAccessService } from './category-access.service';
import { BranchCategoryAccess } from './entities/branch-category-access.entity';
import { DepartmentCategoryAccess } from './entities/department-category-access.entity';
import { UserCategoryAccess } from './entities/user-category-access.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BranchCategoryAccess,
      DepartmentCategoryAccess,
      UserCategoryAccess,
      InsuranceCategory,
      Branch,
      Department,
      CompanyUser,
    ]),
  ],
  controllers: [CategoryAccessController],
  providers: [CategoryAccessService],
  exports: [CategoryAccessService, TypeOrmModule],
})
export class CategoryAccessModule {}
