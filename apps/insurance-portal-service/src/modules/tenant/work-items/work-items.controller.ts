import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

import { TenantScoped } from '@insurance-max/portal-shared';
import {
  AssignWorkItemDto,
  CancelWorkItemDto,
  WorkItemCommentDto,
} from './dto/work-item-actions.dto';
import { WorkItemsService } from './work-items.service';

@Controller('tenant/work-items')
@TenantScoped()
export class WorkItemsController {
  constructor(private readonly workItemsService: WorkItemsService) {}

  @Get()
  @Permissions('work-items:read')
  list(@CurrentUser() user: AuthenticatedUser, @Query('view') view?: string) {
    return this.workItemsService.listForUser(user, view);
  }

  @Get('my')
  @Permissions('work-items:read')
  listMy(@CurrentUser() user: AuthenticatedUser) {
    return this.workItemsService.listForUser(user, 'my');
  }

  @Get('queues')
  @Permissions('work-items:read')
  queues(@CurrentUser() user: AuthenticatedUser) {
    return this.workItemsService.listQueues(user);
  }

  @Get(':id')
  @Permissions('work-items:read')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.workItemsService.findOne(user, id);
  }

  @Get(':id/timeline')
  @Permissions('work-items:read')
  timeline(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.workItemsService.timeline(user, id);
  }

  @Post(':id/claim')
  @Permissions('work-items:claim', 'work-items:manage')
  claim(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.workItemsService.claim(user, id);
  }

  @Post(':id/assign')
  @Permissions('work-items:assign', 'work-items:manage')
  assign(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignWorkItemDto,
  ) {
    return this.workItemsService.assign(user, id, dto, 'ASSIGNED');
  }

  @Post(':id/reassign')
  @Permissions('work-items:reassign', 'work-items:manage')
  reassign(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignWorkItemDto,
  ) {
    return this.workItemsService.assign(user, id, dto, 'REASSIGNED');
  }

  @Post(':id/start')
  @Permissions('work-items:execute', 'work-items:manage')
  start(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.workItemsService.start(user, id);
  }

  @Post(':id/comment')
  @Permissions('work-items:read')
  comment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: WorkItemCommentDto,
  ) {
    return this.workItemsService.comment(user, id, dto);
  }

  @Post(':id/execute')
  @Permissions('work-items:execute', 'work-items:manage')
  execute(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.workItemsService.execute(user, id);
  }

  @Post(':id/cancel')
  @Permissions('work-items:cancel', 'work-items:manage')
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelWorkItemDto,
  ) {
    return this.workItemsService.cancel(user, id, dto);
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
