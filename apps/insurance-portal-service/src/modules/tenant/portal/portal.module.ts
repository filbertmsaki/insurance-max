import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditModule } from '../../shared/audit/audit.module';
import { MailModule } from '../../shared/mail/mail.module';

import { Company } from '../../platform/companies/entities/company.entity';
import { CompanyUser } from '../../platform/companies/entities/company-user.entity';
import { CommissionTransaction } from '../billing-commission/entities/commission-transaction.entity';
import { Invoice } from '../billing-commission/entities/invoice.entity';
import { Receipt } from '../billing-commission/entities/receipt.entity';
import { Complaint } from '../claims/entities/complaint.entity';
import { InsuranceClaim } from '../claims/entities/claim.entity';
import { CommunicationMessage } from '../communications/entities/communication-message.entity';
import { CommunicationThread } from '../communications/entities/communication-thread.entity';
import { CustomersModule } from '../customers/customers.module';
import { Customer } from '../customers/entities/customer.entity';
import { ClaimsModule } from '../claims/claims.module';
import { InsuranceDocumentsModule } from '../insurance-documents/insurance-documents.module';
import { DocumentLink } from '../insurance-documents/entities/document-link.entity';
import { Document } from '../insurance-documents/entities/document.entity';
import { SignatureEvent } from '../insurance-documents/entities/signature-event.entity';
import { SignatureParticipant } from '../insurance-documents/entities/signature-participant.entity';
import { SignatureRequest } from '../insurance-documents/entities/signature-request.entity';
import { InsuranceProduct } from '../insurance-products/entities/insurance-product.entity';
import { InsuranceRisk } from '../insurance-risks/entities/insurance-risk.entity';
import { MotorVehicle } from '../motor/entities/motor-vehicle.entity';
import { Policy } from '../policies/entities/policy.entity';
import { Quotation } from '../quotations/entities/quotation.entity';
import { QuotationsModule } from '../quotations/quotations.module';

import { PortalAccount } from './entities/portal-account.entity';
import { PortalInvitation } from './entities/portal-invitation.entity';
import { PortalNotification } from './entities/portal-notification.entity';
import { PortalPaymentProof } from './entities/portal-payment-proof.entity';
import { PortalRequestAttachment } from './entities/portal-request-attachment.entity';
import { PortalServiceRequest } from './entities/portal-service-request.entity';
import { PortalServiceRequestEvent } from './entities/portal-service-request-event.entity';

import { PortalGuard } from './guards/portal.guard';
import { PortalInvitationExpiryJob } from './jobs/portal-invitation-expiry.job';

import { CustomerPortalController } from './controllers/customer-portal.controller';
import { CustomerMarketplaceController } from './controllers/customer-marketplace.controller';
import { IntermediaryPortalController } from './controllers/intermediary-portal.controller';
import { PortalAdminController } from './controllers/portal-admin.controller';
import { PortalAuthController } from './controllers/portal-auth.controller';
import { PortalCommonController } from './controllers/portal-common.controller';

import { CustomerMarketplaceService } from './services/customer-marketplace.service';
import { PortalAccountsService } from './services/portal-accounts.service';
import { PortalBusinessAccessService } from './services/portal-business-access.service';
import { PortalDashboardService } from './services/portal-dashboard.service';
import { PortalFileStorageService } from './services/portal-file-storage.service';
import { PortalNotificationService } from './services/portal-notification.service';
import { PortalReferenceService } from './services/portal-reference.service';
import { PortalRequestsService } from './services/portal-requests.service';
import { PortalEngagementService } from './services/portal-engagement.service';

/**
 * Full customer/intermediary self-service portal module: invitation
 * onboarding, business-data access, the service-request lifecycle, the
 * dashboard, and every portal-facing/admin controller.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      PortalAccount,
      PortalInvitation,
      PortalServiceRequest,
      PortalServiceRequestEvent,
      PortalRequestAttachment,
      PortalPaymentProof,
      PortalNotification,
      Customer,
      Company,
      CompanyUser,
      InsuranceProduct,
      InsuranceRisk,
      MotorVehicle,
      Quotation,
      Policy,
      InsuranceClaim,
      Complaint,
      Invoice,
      Receipt,
      CommissionTransaction,
      Document,
      DocumentLink,
      CommunicationThread,
      CommunicationMessage,
      SignatureRequest,
      SignatureParticipant,
      SignatureEvent,
    ]),
    AuditModule,
    MailModule,
    QuotationsModule,
    CustomersModule,
    ClaimsModule,
    InsuranceDocumentsModule,
  ],
  controllers: [
    PortalAuthController,
    PortalAdminController,
    CustomerMarketplaceController,
    CustomerPortalController,
    IntermediaryPortalController,
    PortalCommonController,
  ],
  providers: [
    PortalAccountsService,
    CustomerMarketplaceService,
    PortalBusinessAccessService,
    PortalDashboardService,
    PortalFileStorageService,
    PortalNotificationService,
    PortalReferenceService,
    PortalRequestsService,
    PortalEngagementService,
    PortalInvitationExpiryJob,
    PortalGuard,
  ],
  exports: [
    PortalAccountsService,
    PortalBusinessAccessService,
    PortalEngagementService,
    PortalNotificationService,
    PortalRequestsService,
    PortalGuard,
  ],
})
export class PortalModule {}
