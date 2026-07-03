import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Company } from '../../platform/companies/entities/company.entity';
import { InsuranceCategory } from '../insurance-categories/entities/insurance-category.entity';
import { InsuranceProduct } from '../insurance-products/entities/insurance-product.entity';
import { InsuranceRisk } from '../insurance-risks/entities/insurance-risk.entity';
import { InsuranceSubClass } from '../insurance-sub-classes/entities/insurance-sub-class.entity';
import { ProductDistributionChannel } from './entities/product-distribution-channel.entity';
import { ProductCommissionRule } from './entities/product-commission-rule.entity';
import { ProductDocumentRequirement } from './entities/product-document-requirement.entity';
import { ProductTaxRule } from './entities/product-tax-rule.entity';
import { ProductDistributionController } from './product-distribution.controller';
import { ProductDistributionService } from './product-distribution.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Company,
      InsuranceCategory,
      InsuranceProduct,
      InsuranceSubClass,
      InsuranceRisk,
      ProductDistributionChannel,
      ProductCommissionRule,
      ProductTaxRule,
      ProductDocumentRequirement,
    ]),
  ],
  controllers: [ProductDistributionController],
  providers: [ProductDistributionService],
  exports: [ProductDistributionService],
})
export class ProductDistributionModule {}

