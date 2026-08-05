import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InsuranceProduct } from '../insurance-products/entities/insurance-product.entity';
import { ProductVersionSubClass } from '../insurance-products/entities/product-version-sub-class.entity';
import { InsuranceSubClassesController } from './insurance-sub-classes.controller';
import { InsuranceSubClassesService } from './insurance-sub-classes.service';
import { InsuranceSubClass } from './entities/insurance-sub-class.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InsuranceSubClass,
      InsuranceProduct,
      ProductVersionSubClass,
    ]),
  ],
  controllers: [InsuranceSubClassesController],
  providers: [InsuranceSubClassesService],
  exports: [InsuranceSubClassesService, TypeOrmModule],
})
export class InsuranceSubClassesModule {}
