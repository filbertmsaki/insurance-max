import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';

import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

import { ClaimsPermissions } from './claims.permissions';
import { ComplaintsService } from './complaints.service';
import { TenantScoped } from '@insurance-max/portal-shared';
import {
  AddComplaintCommentDto,
  AssignComplaintDto,
  ComplaintDecisionDto,
  CreateComplaintDto,
} from './dto/complaint.dto';

@Controller('tenant/complaints')
@TenantScoped()
export class ComplaintsController {
  constructor(private readonly complaintsService: ComplaintsService) {}

  @Post()
  @Permissions(ClaimsPermissions.COMPLAINT_CREATE)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateComplaintDto,
  ) {
    return this.complaintsService.create(user, dto);
  }

  @Get()
  @Permissions(ClaimsPermissions.COMPLAINT_READ)
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.complaintsService.findAll(user);
  }

  @Get(':id')
  @Permissions(ClaimsPermissions.COMPLAINT_READ)
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.complaintsService.findOne(user, id);
  }

  @Get(':id/comments')
  @Permissions(ClaimsPermissions.COMPLAINT_READ)
  listComments(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.complaintsService.listComments(user, id);
  }

  @Post(':id/acknowledge')
  @Permissions(ClaimsPermissions.COMPLAINT_ASSIGN)
  acknowledge(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.complaintsService.acknowledge(user, id);
  }

  @Post(':id/assign')
  @Permissions(ClaimsPermissions.COMPLAINT_ASSIGN)
  assign(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignComplaintDto,
  ) {
    return this.complaintsService.assign(user, id, dto.assigned_user_id);
  }

  @Post(':id/add-comment')
  @Permissions(ClaimsPermissions.COMPLAINT_ASSIGN)
  addComment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddComplaintCommentDto,
  ) {
    return this.complaintsService.addComment(
      user,
      id,
      dto.body,
      dto.is_customer_visible ?? false,
    );
  }

  @Post(':id/resolve')
  @Permissions(ClaimsPermissions.COMPLAINT_RESOLVE)
  resolve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ComplaintDecisionDto,
  ) {
    return this.complaintsService.resolve(user, id, dto.reason);
  }

  @Post(':id/escalate')
  @Permissions(ClaimsPermissions.COMPLAINT_ESCALATE)
  escalate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ComplaintDecisionDto,
  ) {
    return this.complaintsService.escalate(user, id, dto.reason);
  }

  @Post(':id/close')
  @Permissions(ClaimsPermissions.COMPLAINT_CLOSE)
  close(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ComplaintDecisionDto,
  ) {
    return this.complaintsService.close(user, id, dto.reason);
  }

  @Post(':id/reopen')
  @Permissions(ClaimsPermissions.COMPLAINT_REOPEN)
  reopen(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ComplaintDecisionDto,
  ) {
    return this.complaintsService.reopen(user, id, dto.reason);
  }

  @Post(':id/cancel')
  @Permissions(ClaimsPermissions.COMPLAINT_CANCEL)
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ComplaintDecisionDto,
  ) {
    return this.complaintsService.cancel(user, id, dto.reason);
  }

  @Post(':id/appeal')
  @Permissions(ClaimsPermissions.COMPLAINT_APPEAL_REVIEW)
  appeal(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ComplaintDecisionDto,
  ) {
    return this.complaintsService.appeal(user, id, dto.reason);
  }
}
