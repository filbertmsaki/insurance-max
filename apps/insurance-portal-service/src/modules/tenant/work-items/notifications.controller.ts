import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import { PermissionsGuard } from '@insurance-max/portal-shared/guards/permissions.guard';
import { TenantGuard } from '@insurance-max/portal-shared/guards/tenant.guard';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

import { NotificationsService } from './notifications.service';

@Controller('tenant/notifications')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @Permissions('notifications:read')
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.listForUser(user);
  }

  @Post(':id/read')
  @UseGuards(PermissionsGuard)
  @Permissions('notifications:read')
  markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notificationsService.markRead(user, id);
  }

  @Post('read-all')
  @UseGuards(PermissionsGuard)
  @Permissions('notifications:read')
  markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.markAllRead(user);
  }
}
