import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Branch } from '../branches/entities/branch.entity';
import { CategoryAccessModule } from '../category-access/category-access.module';
import { Company } from '../../platform/companies/entities/company.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Department } from '../departments/entities/department.entity';
import { InsuranceCategory } from '../insurance-categories/entities/insurance-category.entity';
import { InsuranceProduct } from '../insurance-products/entities/insurance-product.entity';
import { InsuranceRisk } from '../insurance-risks/entities/insurance-risk.entity';
import { InsuranceSubClass } from '../insurance-sub-classes/entities/insurance-sub-class.entity';
import { MotorVehicle } from '../motor/entities/motor-vehicle.entity';
import { NonMotorPolicyDetail } from '../non-motor/entities/non-motor-policy-detail.entity';
import { SubjectMatter } from '../non-motor/entities/subject-matter.entity';
import { Quotation } from '../quotations/entities/quotation.entity';
import { QuotationEntryRisk } from '../quotations/entities/structured/quotation-entry-risk.entity';
import { QuotationsModule } from '../quotations/quotations.module';
import { ProductAccessModule } from '../product-access/product-access.module';
import { User } from '../users/entities/user.entity';
import { PolicyPremiumBreakdown } from './entities/policy-premium-breakdown.entity';
import { PolicyRisk } from './entities/policy-risk.entity';
import { PolicyCoverNote } from './entities/policy-cover-note.entity';
import { PolicyStatusHistory } from './entities/policy-status-history.entity';
import { PolicyVersion } from './entities/policy-version.entity';
import { Policy } from './entities/policy.entity';
import { PoliciesController } from './policies.controller';
import { PoliciesService } from './policies.service';
import { PolicyVersionDiffService } from './services/policy-version-diff.service';
import { InsurancePdfService } from '../documents/insurance-pdf.service';
import { InsuranceDocumentsController } from '../documents/insurance-documents.controller';

@Module({
  imports: [
    QuotationsModule,
    CategoryAccessModule,
    ProductAccessModule,
    TypeOrmModule.forFeature([
      Policy,
      PolicyRisk,
      PolicyPremiumBreakdown,
      PolicyCoverNote,
      PolicyStatusHistory,
      PolicyVersion,
      Company,
      Customer,
      Branch,
      Department,
      InsuranceCategory,
      InsuranceProduct,
      InsuranceSubClass,
      InsuranceRisk,
      SubjectMatter,
      MotorVehicle,
      NonMotorPolicyDetail,
      Quotation,
      QuotationEntryRisk,
      User,
    ]),
  ],
  controllers: [PoliciesController, InsuranceDocumentsController],
  providers: [PoliciesService, PolicyVersionDiffService, InsurancePdfService],
  exports: [PoliciesService],
})
export class PoliciesModule {}
