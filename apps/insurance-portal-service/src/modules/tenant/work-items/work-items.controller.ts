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

import { WorkItemsService } from './work-items.service';

@Controller('tenant/work-items')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class WorkItemsController {
  constructor(private readonly workItemsService: WorkItemsService) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @Permissions('work-items:read')
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.workItemsService.listForUser(user);
  }

  @Post(':id/complete')
  @UseGuards(PermissionsGuard)
  @Permissions('work-items:manage')
  complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.workItemsService.complete(user, id);
  }
}
