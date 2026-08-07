import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { NotificationPreference } from './entities/notification-preference.entity';
import { TenantNotification } from './entities/tenant-notification.entity';
import { WorkItemEvent } from './entities/work-item-event.entity';
import { WorkItem } from './entities/work-item.entity';
import {
  NotificationPreferencesController,
  NotificationsController,
} from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { WorkItemsController } from './work-items.controller';
import { WorkItemsService } from './work-items.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorkItem,
      WorkItemEvent,
      TenantNotification,
      NotificationPreference,
    ]),
  ],
  controllers: [
    WorkItemsController,
    NotificationsController,
    NotificationPreferencesController,
  ],
  providers: [WorkItemsService, NotificationsService],
  exports: [WorkItemsService, NotificationsService],
})
export class WorkItemsModule {}
