import { Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

import { WorkItemsService } from './work-items.service';
import { TenantScoped } from '@insurance-max/portal-shared';

@Controller('tenant/work-items')
@TenantScoped()
export class WorkItemsController {
  constructor(private readonly workItemsService: WorkItemsService) {}

  @Get()
  @Permissions('work-items:read')
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.workItemsService.listForUser(user);
  }

  @Post(':id/complete')
  @Permissions('work-items:manage')
  complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.workItemsService.complete(user, id);
  }
}
