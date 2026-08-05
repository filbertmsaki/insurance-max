import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InsuranceProduct } from '../insurance-products/entities/insurance-product.entity';
import { InsuranceCategoriesController } from './insurance-categories.controller';
import { InsuranceCategoriesService } from './insurance-categories.service';
import { InsuranceCategory } from './entities/insurance-category.entity';

@Module({
  imports: [TypeOrmModule.forFeature([InsuranceCategory, InsuranceProduct])],
  controllers: [InsuranceCategoriesController],
  providers: [InsuranceCategoriesService],
  exports: [InsuranceCategoriesService, TypeOrmModule],
})
export class InsuranceCategoriesModule {}
