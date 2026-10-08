import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TiramisPortalNotificationOutboxController } from './controllers/tiramis-portal-notification-outbox.controller';
import { TiramisPortalNotificationOutboxEntity } from './entities/tiramis-portal-notification-outbox.entity';
import { TiramisPortalNotificationOutboxWorkerService } from './services/tiramis-portal-notification-outbox-worker.service';
import { TiramisPortalNotificationService } from './services/tiramis-portal-notification.service';
import { TiramisClientConfigurationEntity } from '../config/entities/tiramis-client-configuration.entity';
import { TiramisCallbackReceiptEntity } from '../callbacks/entities/tiramis-callback-receipt.entity';
import { TiramisCallbackDeadLetterEntity } from '../callbacks/entities/tiramis-callback-dead-letter.entity';
import { TiramisSecurityModule } from '../security/tiramis-security.module';
import { TiramisApiKeysModule } from '../api-keys/tiramis-api-keys.module';

@Module({
  imports: [
    HttpModule,
    TiramisSecurityModule,
    TiramisApiKeysModule,
    TypeOrmModule.forFeature([
      TiramisClientConfigurationEntity,
      TiramisPortalNotificationOutboxEntity,
      TiramisCallbackReceiptEntity,
      TiramisCallbackDeadLetterEntity,
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
