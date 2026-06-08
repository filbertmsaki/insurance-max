import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InsuranceCategory } from '../insurance-categories/entities/insurance-category.entity';
import { InsuranceProductsController } from './insurance-products.controller';
import { InsuranceProductsService } from './insurance-products.service';
import { InsuranceProduct } from './entities/insurance-product.entity';

@Module({
  imports: [TypeOrmModule.forFeature([InsuranceProduct, InsuranceCategory])],
  controllers: [InsuranceProductsController],
  providers: [InsuranceProductsService],
  exports: [InsuranceProductsService, TypeOrmModule],
})
export class InsuranceProductsModule {}
