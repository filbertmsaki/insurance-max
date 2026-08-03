import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

import { TiramisPortalNotificationService } from './services/tiramis-portal-notification.service';

@Module({
  imports: [HttpModule],
  providers: [TiramisPortalNotificationService],
  exports: [TiramisPortalNotificationService],
})
export class TiramisPortalNotificationsModule {}
