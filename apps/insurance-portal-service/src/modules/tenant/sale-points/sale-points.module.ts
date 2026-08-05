import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Branch } from '../branches/entities/branch.entity';
import { TiramisSalePointEntity } from '../../tiramis/entities/tiramis-sale-point.entity';
import { SalePointsController } from './sale-points.controller';
import { SalePointsService } from './sale-points.service';

@Module({
  imports: [TypeOrmModule.forFeature([TiramisSalePointEntity, Branch])],
  controllers: [SalePointsController],
  providers: [SalePointsService],
  exports: [SalePointsService],
})
export class SalePointsModule {}
