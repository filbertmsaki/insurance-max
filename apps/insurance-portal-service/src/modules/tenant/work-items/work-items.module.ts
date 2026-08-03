import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TenantNotification } from './entities/tenant-notification.entity';
import { WorkItem } from './entities/work-item.entity';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { WorkItemsController } from './work-items.controller';
import { WorkItemsService } from './work-items.service';

@Module({
  imports: [TypeOrmModule.forFeature([WorkItem, TenantNotification])],
  controllers: [WorkItemsController, NotificationsController],
  providers: [WorkItemsService, NotificationsService],
  exports: [WorkItemsService, NotificationsService],
})
export class WorkItemsModule {}
