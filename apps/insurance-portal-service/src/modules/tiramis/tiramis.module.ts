import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TiramisCompanyScopeGuard } from './auth/tiramis-company-scope.guard';
import { TiramisPermissionGuard } from './auth/tiramis-permission.guard';
import { TiramisAdminController } from './controllers/tiramis-admin.controller';
import { TiramisBusinessController } from './controllers/tiramis-business.controller';
import { TiramisController } from './controllers/tiramis.controller';
import { TiramisCompanyConfigurationEntity } from './entities/tiramis-company-configuration.entity';
import { TiramisSalePointEntity } from './entities/tiramis-sale-point.entity';
import { TiramisAuditLogEntity } from './entities/tiramis-audit-log.entity';
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
import { TiramisBusinessPayloadBuilderService } from './services/tiramis-business-payload-builder.service';
import { TiramisBusinessSubmitService } from './services/tiramis-business-submit.service';
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
      TiramisCompanyConfigurationEntity,
      TiramisSalePointEntity,
    ]),
    ClientsModule.register([
      {
        name: TIRAMIS_CLIENT,
        transport: Transport.TCP,
        options: {
          host:
            process.env.TIRAMIS_SERVICE_HOST ||
            process.env.TIRAMIS_TCP_HOST ||
            '127.0.0.1',
          port: Number(
            process.env.TIRAMIS_SERVICE_TCP_PORT ||
              process.env.TIRAMIS_TCP_PORT ||
              4001,
          ),
        },
      },
    ]),
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
    TiramisBusinessPayloadBuilderService,
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
    TiramisBusinessPayloadBuilderService,
    TiramisBusinessSubmitService,
    TiramisRetryService,
    TiramisMonitoringService,
    TiramisPermissionGuard,
    TiramisCompanyScopeGuard,
  ],
})
export class TiramisModule {}
