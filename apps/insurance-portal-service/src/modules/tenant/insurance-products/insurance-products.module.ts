import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InsuranceCategory } from '../insurance-categories/entities/insurance-category.entity';
import { InsuranceSubClass } from '../insurance-sub-classes/entities/insurance-sub-class.entity';
import { PricingRuntimeCacheModule } from '../pricing/pricing-runtime-cache.module';
import { InsuranceProductsController } from './insurance-products.controller';
import { InsuranceProductsService } from './insurance-products.service';
import { ProductDefinitionService } from './product-definition.service';
import { InsuranceProduct } from './entities/insurance-product.entity';
import { InsuranceProductVersion } from './entities/insurance-product-version.entity';
import { ProductDefinitionItem } from './entities/product-definition-item.entity';
import { ProductAddonDefinition } from './entities/product-addon-definition.entity';
import { ProductDocumentRequirement } from './entities/product-document-requirement.entity';
import { ProductVersionSubClass } from './entities/product-version-sub-class.entity';

@Module({
  imports: [
    PricingRuntimeCacheModule,
    TypeOrmModule.forFeature([
      InsuranceProduct,
      InsuranceCategory,
      InsuranceSubClass,
      InsuranceProductVersion,
      ProductDefinitionItem,
      ProductAddonDefinition,
      ProductDocumentRequirement,
      ProductVersionSubClass,
    ]),
  ],
  controllers: [InsuranceProductsController],
  providers: [InsuranceProductsService, ProductDefinitionService],
  exports: [InsuranceProductsService, ProductDefinitionService, TypeOrmModule],
})
export class InsuranceProductsModule {}
