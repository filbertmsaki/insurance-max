import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TiramisPortalNotificationService } from './services/tiramis-portal-notification.service';
import { TiramisClientConfigurationEntity } from '../config/entities/tiramis-client-configuration.entity';
import { TiramisSecurityModule } from '../security/tiramis-security.module';

@Module({
  imports: [
    HttpModule,
    TiramisSecurityModule,
    TypeOrmModule.forFeature([TiramisClientConfigurationEntity]),
  ],
  providers: [TiramisPortalNotificationService],
  exports: [TiramisPortalNotificationService],
})
export class TiramisPortalNotificationsModule {}
