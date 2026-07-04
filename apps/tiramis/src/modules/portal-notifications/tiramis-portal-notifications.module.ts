import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';

import { TiramisPortalNotificationService } from './services/tiramis-portal-notification.service';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'INSURANCE_PORTAL_SERVICE_CLIENT',
        transport: Transport.TCP,
        options: {
          host: process.env.INSURANCE_PORTAL_TCP_HOST || '127.0.0.1',
          port: Number(process.env.INSURANCE_PORTAL_TCP_PORT || 4002),
        },
      },
    ]),
  ],
  providers: [TiramisPortalNotificationService],
  exports: [TiramisPortalNotificationService],
})
export class TiramisPortalNotificationsModule {}
