import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';

import { TiramisPortalNotificationService } from './services/tiramis-portal-notification.service';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'INSURANCE_PORTAL_SERVICE_CLIENT',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host: config.getOrThrow<string>('tiramisService.portalHost'),
            port: config.getOrThrow<number>('tiramisService.portalPort'),
          },
        }),
      },
    ]),
  ],
  providers: [TiramisPortalNotificationService],
  exports: [TiramisPortalNotificationService],
})
export class TiramisPortalNotificationsModule {}
