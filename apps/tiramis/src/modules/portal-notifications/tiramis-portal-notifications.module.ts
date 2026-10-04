import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TiramisPortalNotificationOutboxController } from './controllers/tiramis-portal-notification-outbox.controller';
import { TiramisPortalNotificationOutboxEntity } from './entities/tiramis-portal-notification-outbox.entity';
import { TiramisPortalNotificationOutboxWorkerService } from './services/tiramis-portal-notification-outbox-worker.service';
import { TiramisPortalNotificationService } from './services/tiramis-portal-notification.service';
import { TiramisClientConfigurationEntity } from '../config/entities/tiramis-client-configuration.entity';
import { TiramisSecurityModule } from '../security/tiramis-security.module';

@Module({
  imports: [
    HttpModule,
    TiramisSecurityModule,
    TypeOrmModule.forFeature([
      TiramisClientConfigurationEntity,
      TiramisPortalNotificationOutboxEntity,
    ]),
  ],
  controllers: [TiramisPortalNotificationOutboxController],
  providers: [
    TiramisPortalNotificationService,
    TiramisPortalNotificationOutboxWorkerService,
  ],
  exports: [TiramisPortalNotificationService],
})
export class TiramisPortalNotificationsModule {}
