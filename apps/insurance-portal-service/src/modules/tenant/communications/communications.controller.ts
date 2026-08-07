import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import { TenantScoped } from '@insurance-max/portal-shared';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

import {
  AssignCommunicationThreadDto,
  CreateCommunicationMessageDto,
  CreateCommunicationThreadDto,
} from './dto/communications.dto';
import { CommunicationsService } from './communications.service';

@Controller('tenant/communications/threads')
@TenantScoped()
export class CommunicationsController {
  constructor(private readonly communicationsService: CommunicationsService) {}

  @Get()
  @Permissions('communications:read')
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.communicationsService.listThreads(user);
  }

  @Post()
  @Permissions('communications:create-thread', 'communications:read')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCommunicationThreadDto,
  ) {
    return this.communicationsService.createThread(user, dto);
  }

  @Get(':id')
  @Permissions('communications:read')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.communicationsService.findThread(user, id);
  }

  @Get(':id/messages')
  @Permissions('communications:read')
  messages(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.communicationsService.listMessages(user, id);
  }

  @Post(':id/messages')
  @Permissions('communications:send', 'communications:read')
  postMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCommunicationMessageDto,
  ) {
    return this.communicationsService.postMessage(user, id, dto);
  }

  @Post(':id/assign')
  @Permissions('communications:assign', 'communications:read')
  assign(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignCommunicationThreadDto,
  ) {
    return this.communicationsService.assign(user, id, dto);
  }

  @Post(':id/close')
  @Permissions('communications:close', 'communications:read')
  close(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.communicationsService.close(user, id);
  }

  @Post(':id/reopen')
  @Permissions('communications:close', 'communications:read')
  reopen(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.communicationsService.reopen(user, id);
  }
}
