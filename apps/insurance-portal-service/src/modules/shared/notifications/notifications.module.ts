import { Global, Module } from '@nestjs/common';

import { NotificationBusService } from './notification-bus.service';
import { NotificationPublisherService } from './notification-publisher.service';
import { NotificationStreamController } from './notification-stream.controller';

@Global()
@Module({
  controllers: [NotificationStreamController],
  providers: [NotificationBusService, NotificationPublisherService],
  exports: [NotificationBusService, NotificationPublisherService],
})
export class NotificationsModule {}
