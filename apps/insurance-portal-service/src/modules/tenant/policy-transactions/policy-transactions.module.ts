import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { IdentifierGeneratorService } from '../../shared/identifiers/identifier-generator.service';
import { InsuranceClaim } from '../claims/entities/claim.entity';
import { Company } from '../../platform/companies/entities/company.entity';
import { User } from '../users/entities/user.entity';
import { Policy } from '../policies/entities/policy.entity';
import { PolicyPremiumBreakdown } from '../policies/entities/policy-premium-breakdown.entity';
import { PolicyRisk } from '../policies/entities/policy-risk.entity';
import { PolicyStatusHistory } from '../policies/entities/policy-status-history.entity';
import { PolicyVersion } from '../policies/entities/policy-version.entity';
import { InsuranceProductVersion } from '../insurance-products/entities/insurance-product-version.entity';
import { Quotation } from '../quotations/entities/quotation.entity';
import { PortalServiceRequest } from '../portal/entities/portal-service-request.entity';
import { Invoice } from '../billing-commission/entities/invoice.entity';
import { InvoiceItem } from '../billing-commission/entities/invoice-item.entity';
import { TiramisIntegrationModule } from '../tiramis-integration/tiramis-integration.module';

import { EndorsementType } from './entities/endorsement-type.entity';
import { PolicyTransaction } from './entities/policy-transaction.entity';
import { PolicyTransactionChange } from './entities/policy-transaction-change.entity';
import { PolicyTransactionEvent } from './entities/policy-transaction-event.entity';
import { PolicyEndorsement } from './entities/policy-endorsement.entity';
import { PolicyCancellation } from './entities/policy-cancellation.entity';
import { PolicyRenewal } from './entities/policy-renewal.entity';

import { PolicyTransactionEligibilityService } from './services/policy-transaction-eligibility.service';
import { ProposedPolicySnapshotService } from './services/proposed-policy-snapshot.service';
import { EndorsementPricingService } from './services/endorsement-pricing.service';
import { CancellationPricingService } from './services/cancellation-pricing.service';
import { RenewalEligibilityService } from './services/renewal-eligibility.service';
import { PolicyTransactionLifecycleService } from './services/policy-transaction-lifecycle.service';
import { EndorsementTypesService } from './services/endorsement-types.service';
import { EndorsementService } from './services/endorsement.service';
import { CancellationService } from './services/cancellation.service';
import { RenewalService } from './services/renewal.service';
import { AdministrativeAmendmentService } from './services/administrative-amendment.service';
import { PortalRequestTransactionService } from './services/portal-request-transaction.service';
import { PolicyTransactionInvoiceService } from './services/policy-transaction-invoice.service';
import { PolicyTransactionApplyService } from './services/policy-transaction-apply.service';
import { PolicyTransactionTiramisPayloadService } from './services/policy-transaction-tiramis-payload.service';
import { PolicyTransactionTiramisSubmissionService } from './services/policy-transaction-tiramis-submission.service';

import { PolicyTransactionsController } from './controllers/policy-transactions.controller';
import { EndorsementsController } from './controllers/endorsements.controller';
import { CancellationsController } from './controllers/cancellations.controller';
import { RenewalsController } from './controllers/renewals.controller';
import { EndorsementTypesController } from './controllers/endorsement-types.controller';
import { AdministrativeAmendmentController } from './controllers/administrative-amendment.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PolicyTransaction,
      PolicyTransactionChange,
      PolicyTransactionEvent,
      PolicyEndorsement,
      PolicyCancellation,
      PolicyRenewal,
      EndorsementType,
      Policy,
      PolicyRisk,
      PolicyPremiumBreakdown,
      PolicyStatusHistory,
      PolicyVersion,
      InsuranceProductVersion,
      InsuranceClaim,
      Quotation,
      PortalServiceRequest,
      Invoice,
      InvoiceItem,
      Company,
      User,
    ]),
    forwardRef(() => TiramisIntegrationModule),
  ],
  controllers: [
    PolicyTransactionsController,
    EndorsementsController,
    CancellationsController,
    RenewalsController,
    EndorsementTypesController,
    AdministrativeAmendmentController,
  ],
  providers: [
    IdentifierGeneratorService,
    PolicyTransactionEligibilityService,
    ProposedPolicySnapshotService,
    EndorsementPricingService,
    CancellationPricingService,
    RenewalEligibilityService,
    PolicyTransactionLifecycleService,
    EndorsementTypesService,
    EndorsementService,
    CancellationService,
    RenewalService,
    AdministrativeAmendmentService,
    PortalRequestTransactionService,
    PolicyTransactionInvoiceService,
    PolicyTransactionApplyService,
    PolicyTransactionTiramisPayloadService,
    PolicyTransactionTiramisSubmissionService,
  ],
  exports: [
    PolicyTransactionLifecycleService,
    EndorsementService,
    CancellationService,
    RenewalService,
    AdministrativeAmendmentService,
    PortalRequestTransactionService,
    EndorsementTypesService,
    PolicyTransactionApplyService,
    PolicyTransactionTiramisSubmissionService,
  ],
})
export class PolicyTransactionsModule {}
