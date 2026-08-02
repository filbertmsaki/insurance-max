import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TiramisCompanyScopeGuard } from './auth/tiramis-company-scope.guard';
import { TiramisPermissionGuard } from './auth/tiramis-permission.guard';
import { TiramisAdminController } from './controllers/tiramis-admin.controller';
import { TiramisBusinessController } from './controllers/tiramis-business.controller';
import { TiramisController } from './controllers/tiramis.controller';
import { TiramisCompanyConfigurationEntity } from './entities/tiramis-company-configuration.entity';
import { TiramisSalePointEntity } from './entities/tiramis-sale-point.entity';
import { TiramisAuditLogEntity } from './entities/tiramis-audit-log.entity';
import { TiramisBusinessRecordEntity } from './entities/tiramis-business-record.entity';
import { TiramisNotificationEntity } from './entities/tiramis-notification.entity';
import { TiramisSubmissionTrackingEntity } from './entities/tiramis-submission-tracking.entity';
import { TiramisAuditLogRepository } from './repositories/tiramis-audit-log.repository';
import { TiramisNotificationRepository } from './repositories/tiramis-notification.repository';
import { TiramisSubmissionTrackingRepository } from './repositories/tiramis-submission-tracking.repository';
import {
  TIRAMIS_CLIENT,
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
import { TiramisMonitoringService } from './services/tiramis-monitoring.service';
import { TiramisNotificationService } from './services/tiramis-notification.service';
import { TiramisRetryService } from './services/tiramis-retry.service';
import { TiramisStatusSyncService } from './services/tiramis-status-sync.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TiramisSubmissionTrackingEntity,
      TiramisAuditLogEntity,
      TiramisNotificationEntity,
      TiramisBusinessRecordEntity,
      TiramisCompanyConfigurationEntity,
      TiramisSalePointEntity,
    ]),
    HttpModule,
  ],
  controllers: [
    TiramisController,
    TiramisBusinessController,
    TiramisAdminController,
  ],
  providers: [
    TiramisClientService,
    TiramisSubmissionTrackingRepository,
    TiramisAuditLogRepository,
    TiramisAuditService,
    TiramisNotificationRepository,
    TiramisNotificationService,
    TiramisStatusSyncService,
    TiramisBusinessRecordSyncService,
    TiramisBusinessSchemaService,
    TiramisDashboardService,
    TiramisAccessScopeService,
    TiramisBusinessPayloadBuilderService,
    TiramisBusinessValidationService,
    TiramisBusinessSubmitService,
    TiramisRetryService,
    TiramisMonitoringService,
    TiramisPermissionGuard,
    TiramisCompanyScopeGuard,
  ],
  exports: [
    TiramisClientService,
    TiramisSubmissionTrackingRepository,
    TiramisAuditLogRepository,
    TiramisAuditService,
    TiramisNotificationRepository,
    TiramisNotificationService,
    TiramisStatusSyncService,
    TiramisBusinessRecordSyncService,
    TiramisBusinessSchemaService,
    TiramisDashboardService,
    TiramisAccessScopeService,
    TiramisBusinessPayloadBuilderService,
    TiramisBusinessValidationService,
    TiramisBusinessSubmitService,
    TiramisRetryService,
    TiramisMonitoringService,
    TiramisPermissionGuard,
    TiramisCompanyScopeGuard,
  ],
})
export class TiramisModule {}
