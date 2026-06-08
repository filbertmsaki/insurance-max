import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Branch } from '../branches/entities/branch.entity';
import { CompanyUser } from '../companies/entities/company-user.entity';
import { Department } from '../departments/entities/department.entity';
import { InsuranceProduct } from '../insurance-products/entities/insurance-product.entity';
import { ProductAccessController } from './product-access.controller';
import { ProductAccessService } from './product-access.service';
import { BranchProductAccess } from './entities/branch-product-access.entity';
import { DepartmentProductAccess } from './entities/department-product-access.entity';
import { UserProductAccess } from './entities/user-product-access.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BranchProductAccess,
      DepartmentProductAccess,
      UserProductAccess,
      InsuranceProduct,
      Branch,
      Department,
      CompanyUser,
    ]),
  ],
  controllers: [ProductAccessController],
  providers: [ProductAccessService],
  exports: [ProductAccessService, TypeOrmModule],
})
export class ProductAccessModule {}
