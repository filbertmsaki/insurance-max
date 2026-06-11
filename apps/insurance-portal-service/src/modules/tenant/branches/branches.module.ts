import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompanyUser } from '../../platform/companies/entities/company-user.entity';
import { User } from '../users/entities/user.entity';
import {
  BranchesController,
  CompanyFeaturesController,
} from './branches.controller';
import { BranchesService } from './branches.service';
import { BranchFeature } from './entities/branch-feature.entity';
import { BranchUser } from './entities/branch-user.entity';
import { Branch } from './entities/branch.entity';
import { CompanyFeature } from './entities/company-feature.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Branch,
      BranchUser,
      CompanyFeature,
      BranchFeature,
      CompanyUser,
      User,
    ]),
  ],
  controllers: [BranchesController, CompanyFeaturesController],
  providers: [BranchesService],
  exports: [BranchesService, TypeOrmModule],
})
export class BranchesModule {}
