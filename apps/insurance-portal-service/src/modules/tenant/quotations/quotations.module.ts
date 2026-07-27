import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Company } from '../../platform/companies/entities/company.entity';
import { TiramisModule } from '../../tiramis/tiramis.module';
import { TiramisSubmissionTrackingEntity } from '../../tiramis/entities/tiramis-submission-tracking.entity';
import { Branch } from '../branches/entities/branch.entity';
import { Invoice } from '../billing-commission/entities/invoice.entity';
import { PaymentTransaction } from '../billing-commission/entities/payment-transaction.entity';
import { Receipt } from '../billing-commission/entities/receipt.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Department } from '../departments/entities/department.entity';
import { InsuranceCategory } from '../insurance-categories/entities/insurance-category.entity';
import { InsuranceProduct } from '../insurance-products/entities/insurance-product.entity';
import { InsuranceRisk } from '../insurance-risks/entities/insurance-risk.entity';
import { InsuranceSubClass } from '../insurance-sub-classes/entities/insurance-sub-class.entity';
import { MotorVehicle } from '../motor/entities/motor-vehicle.entity';
import { User } from '../users/entities/user.entity';
import { Quotation } from './entities/quotation.entity';
import { QuotationStatusHistory } from './entities/quotation-status-history.entity';
import { QuotationCoverNoteEntry } from './entities/structured/quotation-cover-note-entry.entity';
import { QuotationCoverNote } from './entities/structured/quotation-cover-note.entity';
import { QuotationEntryAddonTax } from './entities/structured/quotation-entry-addon-tax.entity';
import { QuotationEntryAddon } from './entities/structured/quotation-entry-addon.entity';
import { QuotationEntryRisk } from './entities/structured/quotation-entry-risk.entity';
import { QuotationMotorDetail } from './entities/structured/quotation-motor-detail.entity';
import { QuotationPolicyHolder } from './entities/structured/quotation-policy-holder.entity';
import { QuotationRiskDiscount } from './entities/structured/quotation-risk-discount.entity';
import { QuotationRiskPremiumOverride } from './entities/structured/quotation-risk-premium-override.entity';
import { QuotationRiskTax } from './entities/structured/quotation-risk-tax.entity';
import { QuotationSubjectMatter } from './entities/structured/quotation-subject-matter.entity';
import { PortalTiraSubmission } from '../tiramis-integration/entities/portal-tira-submission.entity';
import { PortalTiraSubmissionEvent } from '../tiramis-integration/entities/portal-tira-submission-event.entity';
import { QuotationPayloadMapper } from './mappers/quotation-payload.mapper';
import { QuotationPreviewMapper } from './mappers/quotation-preview.mapper';
import { QuotationTiramisPayloadMapper } from './mappers/quotation-tiramis-payload.mapper';
import { QuotationsController } from './quotations.controller';
import { QuotationsRepository } from './repositories/quotations.repository';
import { QuotationPayloadValidator } from './services/quotation-payload.validator';
import { QuotationDisplayStatusResolver } from './services/quotation-display-status.resolver';
import { QuotationLifecycleService } from './services/quotation-lifecycle.service';
import { QuotationsService } from './quotations.service';
import { IdentifierGeneratorService } from '../../shared/identifiers/identifier-generator.service';
import { PricingModule } from '../pricing/pricing.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Quotation,
      QuotationStatusHistory,
      QuotationCoverNote,
      QuotationCoverNoteEntry,
      QuotationPolicyHolder,
      QuotationEntryRisk,
      QuotationRiskDiscount,
      QuotationRiskPremiumOverride,
      QuotationRiskTax,
      QuotationSubjectMatter,
      QuotationEntryAddon,
      QuotationEntryAddonTax,
      QuotationMotorDetail,
      Invoice,
      Receipt,
      PaymentTransaction,
      PortalTiraSubmission,
      PortalTiraSubmissionEvent,
      TiramisSubmissionTrackingEntity,
      MotorVehicle,
      Company,
      Customer,
      Branch,
      Department,
      InsuranceCategory,
      InsuranceProduct,
      InsuranceSubClass,
      InsuranceRisk,
      User,
    ]),
    TiramisModule,
    PricingModule,
  ],
  controllers: [QuotationsController],
  providers: [
    QuotationsService,
    QuotationsRepository,
    QuotationPayloadMapper,
    QuotationPreviewMapper,
    QuotationTiramisPayloadMapper,
    QuotationPayloadValidator,
    QuotationDisplayStatusResolver,
    QuotationLifecycleService,
    IdentifierGeneratorService,
  ],
  exports: [
    QuotationsService,
    QuotationsRepository,
    QuotationPayloadMapper,
    QuotationPreviewMapper,
    QuotationTiramisPayloadMapper,
    QuotationDisplayStatusResolver,
    QuotationLifecycleService,
  ],
})
export class QuotationsModule {}
