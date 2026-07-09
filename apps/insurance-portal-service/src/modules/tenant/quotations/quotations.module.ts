import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Branch } from '../branches/entities/branch.entity';
import { Company } from '../../platform/companies/entities/company.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Department } from '../departments/entities/department.entity';
import { InsuranceCategory } from '../insurance-categories/entities/insurance-category.entity';
import { InsuranceProduct } from '../insurance-products/entities/insurance-product.entity';
import { InsuranceRisk } from '../insurance-risks/entities/insurance-risk.entity';
import { InsuranceSubClass } from '../insurance-sub-classes/entities/insurance-sub-class.entity';
import { ProductDistributionModule } from '../product-distribution/product-distribution.module';
import { RatingFactor } from '../rating-factors/entities/rating-factor.entity';
import { User } from '../users/entities/user.entity';
import { QuotationAddon } from './entities/quotation-addon.entity';
import { QuotationAddonTax } from './entities/quotation-addon-tax.entity';
import { Quotation } from './entities/quotation.entity';
import { QuotationFactorValue } from './entities/quotation-factor-value.entity';
import { QuotationPremiumBreakdown } from './entities/quotation-premium-breakdown.entity';
import { QuotationRisk } from './entities/quotation-risk.entity';
import { QuotationStatusHistory } from './entities/quotation-status-history.entity';
import { QuotationsController } from './quotations.controller';
import { QuotationsService } from './quotations.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Quotation,
      QuotationRisk,
      QuotationFactorValue,
      QuotationPremiumBreakdown,
      QuotationAddon,
      QuotationAddonTax,
      QuotationStatusHistory,
      Company,
      Customer,
      Branch,
      Department,
      InsuranceCategory,
      InsuranceProduct,
      InsuranceSubClass,
      InsuranceRisk,
      RatingFactor,
      User,
    ]),
    ProductDistributionModule,
  ],
  controllers: [QuotationsController],
  providers: [QuotationsService],
  exports: [QuotationsService],
})
export class QuotationsModule {}
