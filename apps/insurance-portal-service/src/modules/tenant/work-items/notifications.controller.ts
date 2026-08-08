import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

import { TenantScoped } from '@insurance-max/portal-shared';
import { UpdateNotificationPreferencesDto } from './dto/work-item-actions.dto';
import { NotificationsService } from './notifications.service';

@Controller('tenant/notifications')
@TenantScoped()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @Permissions('notifications:read')
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.listForUser(user);
  }

  @Get('unread-count')
  @Permissions('notifications:read')
  async unreadCount(@CurrentUser() user: AuthenticatedUser) {
    return {
      count: await this.notificationsService.unreadCount(user),
      latest: await this.notificationsService.latestForUser(user),
    };
  }

  @Get(':id')
  @Permissions('notifications:read')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notificationsService.findOne(user, id);
  }

  @Post(':id/read')
  @Permissions('notifications:read')
  markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notificationsService.markRead(user, id);
  }

  @Post(':id/unread')
  @Permissions('notifications:read')
  markUnread(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notificationsService.markUnread(user, id);
  }

  @Post(':id/dismiss')
  @Permissions('notifications:read')
  dismiss(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notificationsService.dismiss(user, id);
  }

  @Post('read-all')
  @Permissions('notifications:read')
  markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.markAllRead(user);
  }
}

@Controller('tenant/notification-preferences')
@TenantScoped()
export class NotificationPreferencesController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @Permissions('notifications:manage-preferences', 'notifications:read')
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.listPreferences(user);
  }

  @Put()
  @Permissions('notifications:manage-preferences', 'notifications:read')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateNotificationPreferencesDto,
  ) {
    return this.notificationsService.updatePreferences(user, dto);
  }
}
