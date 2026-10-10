import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TiramisHttpModule } from '../../integrations/tiramis/tiramis-http.module';
import { IssuanceModule } from '../tenant/issuance/issuance.module';
import { PortalTiraSubmission } from '../tenant/tiramis-integration/entities/portal-tira-submission.entity';
import { TiramisCompanyScopeGuard } from './auth/tiramis-company-scope.guard';
import { TiramisPermissionGuard } from './auth/tiramis-permission.guard';
import { TiramisAdminController } from './controllers/tiramis-admin.controller';
import { TiramisBusinessController } from './controllers/tiramis-business.controller';
import { TiramisController } from './controllers/tiramis.controller';
import { PlatformTiramisIntegrationController } from './controllers/platform-tiramis-integration.controller';
import { PlatformTiramisIntegrationService } from './services/platform-tiramis-integration.service';
import { TiramisCompanyLinkEntity } from './entities/tiramis-company-link.entity';
import { TiramisPlatformSettingsEntity } from './entities/tiramis-platform-settings.entity';
import { CompanyTiramisConfigurationService } from './services/company-tiramis-configuration.service';
import { Company } from '../platform/companies/entities/company.entity';
import { TiramisCompanyConfigurationEntity } from './entities/tiramis-company-configuration.entity';
import { TiramisLookupEntity } from './entities/tiramis-lookup.entity';
import { TiramisSalePointEntity } from './entities/tiramis-sale-point.entity';
import { TiramisAuditLogEntity } from './entities/tiramis-audit-log.entity';
import { TiramisBusinessRecordEntity } from './entities/tiramis-business-record.entity';
import { TiramisNotificationEntity } from './entities/tiramis-notification.entity';
import { TiramisSubmissionTrackingEntity } from './entities/tiramis-submission-tracking.entity';
import { TiramisAuditLogRepository } from './repositories/tiramis-audit-log.repository';
import { TiramisNotificationRepository } from './repositories/tiramis-notification.repository';
import { TiramisSubmissionTrackingRepository } from './repositories/tiramis-submission-tracking.repository';
import {
  TIRAMIS_BUSINESS_RECORD_SYNC_SERVICE,
  TiramisClientService,
} from './services/tiramis-client.service';
import { TiramisBusinessRecordSyncService } from './services/tiramis-business-record-sync.service';
import { TiramisBusinessSchemaService } from './services/tiramis-business-schema.service';
import { TiramisDashboardService } from './services/tiramis-dashboard.service';
import { TiramisAccessScopeService } from './services/tiramis-access-scope.service';
import { TiramisBusinessPayloadBuilderService } from './services/tiramis-business-payload-builder.service';
import { TiramisBusinessSubmitService } from './services/tiramis-business-submit.service';
import { TiramisBusinessValidationService } from './services/tiramis-business-validation.service';
import { TiramisAuditService } from './services/tiramis-audit.service';
import { TiramisEnvelopeService } from './services/tiramis-envelope.service';
import { TiramisMonitoringService } from './services/tiramis-monitoring.service';
import { TiramisNotificationService } from './services/tiramis-notification.service';
import { TiramisRetryService } from './services/tiramis-retry.service';
import { TiramisServiceApiKeyVaultService } from './services/tiramis-service-api-key-vault.service';
import { TiramisStatusSyncService } from './services/tiramis-status-sync.service';
import { TiramisWebhookCredentialService } from './services/tiramis-webhook-credential.service';
import { ApiClientsModule } from '../platform/api-clients/api-clients.module';
import { Customer } from '../tenant/customers/entities/customer.entity';
import { ClaimAssessment } from '../tenant/claims/entities/claim-assessment.entity';
import { ClaimDischargeVoucher } from '../tenant/claims/entities/claim-discharge-voucher.entity';
import { InsuranceClaim } from '../tenant/claims/entities/claim.entity';
import { ClaimIntimation } from '../tenant/claims/entities/claim-intimation.entity';
import { ClaimPayment } from '../tenant/claims/entities/claim-payment.entity';
import { ClaimRejection } from '../tenant/claims/entities/claim-rejection.entity';
import { MotorFleet } from '../tenant/motor/entities/motor-fleet.entity';
import { MotorPolicyDetail } from '../tenant/motor/entities/motor-policy-detail.entity';
import { MotorVehicle } from '../tenant/motor/entities/motor-vehicle.entity';
import { NonMotorPolicyDetail } from '../tenant/non-motor/entities/non-motor-policy-detail.entity';
import { Policy } from '../tenant/policies/entities/policy.entity';
import { Quotation } from '../tenant/quotations/entities/quotation.entity';
import { ReinsuranceDeclaration } from '../tenant/reinsurance/entities/reinsurance-declaration.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TiramisSubmissionTrackingEntity,
      TiramisAuditLogEntity,
      TiramisNotificationEntity,
      TiramisBusinessRecordEntity,
      TiramisCompanyConfigurationEntity,
      TiramisPlatformSettingsEntity,
      TiramisCompanyLinkEntity,
      TiramisLookupEntity,
      TiramisSalePointEntity,
      Quotation,
      Policy,
      Customer,
      InsuranceClaim,
      ClaimIntimation,
      ClaimAssessment,
      ClaimDischargeVoucher,
      ClaimPayment,
      ClaimRejection,
      MotorVehicle,
      MotorFleet,
      MotorPolicyDetail,
      NonMotorPolicyDetail,
      ReinsuranceDeclaration,
      Company,
      PortalTiraSubmission,
    ]),
    TiramisHttpModule,
    IssuanceModule,
    ApiClientsModule,
  ],
  controllers: [
    TiramisController,
    TiramisBusinessController,
    TiramisAdminController,
    // Platform → TIRAMIS Integration replaces the per-company configuration
    // screens: companies no longer configure TIRAMIS themselves.
    PlatformTiramisIntegrationController,
  ],
  providers: [
    TiramisClientService,
    PlatformTiramisIntegrationService,
    CompanyTiramisConfigurationService,
    TiramisSubmissionTrackingRepository,
    TiramisAuditLogRepository,
    TiramisAuditService,
    TiramisNotificationRepository,
    TiramisNotificationService,
    TiramisStatusSyncService,
    TiramisWebhookCredentialService,
    TiramisBusinessRecordSyncService,
    {
      provide: TIRAMIS_BUSINESS_RECORD_SYNC_SERVICE,
      useExisting: TiramisBusinessRecordSyncService,
    },
    TiramisBusinessSchemaService,
    TiramisDashboardService,
    TiramisAccessScopeService,
    TiramisBusinessPayloadBuilderService,
    TiramisBusinessValidationService,
    TiramisBusinessSubmitService,
    TiramisEnvelopeService,
    TiramisRetryService,
    TiramisMonitoringService,
    TiramisServiceApiKeyVaultService,
    TiramisPermissionGuard,
    TiramisCompanyScopeGuard,
  ],
  exports: [
    TiramisClientService,
    CompanyTiramisConfigurationService,
    TiramisSubmissionTrackingRepository,
    TiramisAuditLogRepository,
    TiramisAuditService,
    TiramisNotificationRepository,
    TiramisNotificationService,
    TiramisStatusSyncService,
    TiramisWebhookCredentialService,
    TiramisBusinessRecordSyncService,
    TIRAMIS_BUSINESS_RECORD_SYNC_SERVICE,
    TiramisBusinessSchemaService,
    TiramisDashboardService,
    TiramisAccessScopeService,
    TiramisBusinessPayloadBuilderService,
    TiramisBusinessValidationService,
    TiramisBusinessSubmitService,
    TiramisEnvelopeService,
    TiramisRetryService,
    TiramisMonitoringService,
    TiramisServiceApiKeyVaultService,
    TiramisPermissionGuard,
    TiramisCompanyScopeGuard,
  ],
})
export class TiramisModule {}
