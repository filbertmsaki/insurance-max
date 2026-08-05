import {
  Body,
  Controller,
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
}
