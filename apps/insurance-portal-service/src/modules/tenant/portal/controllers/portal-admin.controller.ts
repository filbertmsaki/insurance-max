import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import { PermissionsGuard } from '@insurance-max/portal-shared/guards/permissions.guard';
import { TenantGuard } from '@insurance-max/portal-shared/guards/tenant.guard';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { RawResponse } from '@insurance-max/shared-kernel';

import {
  InviteCustomerPortalDto,
  InviteIntermediaryPortalDto,
  PortalInvitationFilterDto,
  RevokePortalInvitationDto,
  SuspendPortalAccountDto,
} from '../dto/portal-invitation.dto';
import {
  AssignPortalRequestDto,
  CompletePortalRequestDto,
  PortalRequestFilterDto,
  ReviewPaymentProofDto,
  TransitionPortalRequestDto,
} from '../dto/portal-request.dto';
import { PortalPermissions } from '../portal.permissions';
import { PortalAccountsService } from '../services/portal-accounts.service';
import { PortalRequestsService } from '../services/portal-requests.service';

// Each route below needs a different permission, so PermissionsGuard is
// applied per-method alongside @Permissions(...) (matching this codebase's
// established convention, e.g. claims.controller.ts) rather than once at
// class level.
@ApiTags('Portal administration')
@ApiBearerAuth('access-token')
@Controller({ path: 'tenant/portal', version: '1' })
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class PortalAdminController {
  constructor(
    private readonly accountsService: PortalAccountsService,
    private readonly requestsService: PortalRequestsService,
  ) {}

  @Post('invitations/customer')
  @UseGuards(PermissionsGuard)
  @Permissions(PortalPermissions.ACCOUNT_INVITE)
  @ApiOperation({ summary: 'Invite an existing customer to the portal' })
  inviteCustomer(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: InviteCustomerPortalDto,
  ) {
    return this.accountsService.inviteCustomer(user.companyId!, user.id, dto);
  }

  @Post('invitations/intermediary')
  @UseGuards(PermissionsGuard)
  @Permissions(PortalPermissions.ACCOUNT_INVITE)
  @ApiOperation({ summary: 'Invite an intermediary user' })
  inviteIntermediary(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: InviteIntermediaryPortalDto,
  ) {
    return this.accountsService.inviteIntermediary(
      user.companyId!,
      user.id,
      dto,
    );
  }

  @Get('invitations')
  @UseGuards(PermissionsGuard)
  @Permissions(PortalPermissions.ACCOUNT_READ)
  @ApiOperation({
    summary: 'List portal invitations with lifecycle and delivery status',
  })
  invitations(
    @CurrentUser() user: AuthenticatedUser,
    @Query() filters: PortalInvitationFilterDto,
  ) {
    return this.accountsService.listInvitations(user.companyId!, filters);
  }

  @Post('invitations/:id/resend')
  @UseGuards(PermissionsGuard)
  @Permissions(PortalPermissions.ACCOUNT_INVITE)
  @ApiOperation({
    summary: 'Re-issue a pending or expired invitation with a new link',
  })
  resendInvitation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.accountsService.resendInvitation(user.companyId!, id, user.id);
  }

  @Post('invitations/:id/revoke')
  @UseGuards(PermissionsGuard)
  @Permissions(PortalPermissions.ACCOUNT_INVITE)
  @ApiOperation({ summary: 'Revoke a pending invitation' })
  revokeInvitation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RevokePortalInvitationDto,
  ) {
    return this.accountsService.revokeInvitation(
      user.companyId!,
      id,
      user.id,
      dto.reason,
    );
  }

  @Get('accounts')
  @UseGuards(PermissionsGuard)
  @Permissions(PortalPermissions.ACCOUNT_READ)
  @ApiOperation({ summary: 'List company portal accounts' })
  accounts(@CurrentUser() user: AuthenticatedUser) {
    return this.accountsService.findAll(user.companyId!);
  }

  @Patch('accounts/:id/suspend')
  @UseGuards(PermissionsGuard)
  @Permissions(PortalPermissions.ACCOUNT_SUSPEND)
  @ApiOperation({ summary: 'Suspend a portal account' })
  suspend(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SuspendPortalAccountDto,
  ) {
    return this.accountsService.suspend(
      user.companyId!,
      id,
      user.id,
      dto.reason,
    );
  }

  @Patch('accounts/:id/activate')
  @UseGuards(PermissionsGuard)
  @Permissions(PortalPermissions.ACCOUNT_UPDATE)
  @ApiOperation({ summary: 'Reactivate a suspended portal account' })
  activate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.accountsService.activate(user.companyId!, id, user.id);
  }

  @Get('requests')
  @UseGuards(PermissionsGuard)
  @Permissions(PortalPermissions.REQUEST_READ)
  @ApiOperation({ summary: 'List company portal service requests' })
  requests(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PortalRequestFilterDto,
  ) {
    return this.requestsService.findCompanyRequests(user.companyId!, query);
  }

  @Get('requests/:id')
  @UseGuards(PermissionsGuard)
  @Permissions(PortalPermissions.REQUEST_READ)
  @ApiOperation({ summary: 'Get a company portal service request' })
  requestDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.requestsService.findCompanyRequestDetail(user.companyId!, id);
  }

  @Post('requests/:id/assign')
  @UseGuards(PermissionsGuard)
  @Permissions(PortalPermissions.REQUEST_ASSIGN)
  @ApiOperation({
    summary: 'Assign a portal service request to a company user',
  })
  assign(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignPortalRequestDto,
  ) {
    return this.requestsService.assign(user.companyId!, id, user.id, dto);
  }

  @Post('requests/:id/transition')
  @UseGuards(PermissionsGuard)
  @Permissions(PortalPermissions.REQUEST_REVIEW)
  @ApiOperation({ summary: 'Change the status of a portal service request' })
  transition(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransitionPortalRequestDto,
  ) {
    return this.requestsService.transitionCompanyRequest(
      user.companyId!,
      id,
      user.id,
      dto,
    );
  }

  @Post('requests/:id/complete')
  @UseGuards(PermissionsGuard)
  @Permissions(PortalPermissions.REQUEST_COMPLETE)
  @ApiOperation({
    summary: 'Complete an approved portal service request with its result',
  })
  complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompletePortalRequestDto,
  ) {
    return this.requestsService.completeCompanyRequest(
      user.companyId!,
      id,
      user.id,
      dto,
    );
  }

  @Post('requests/:id/payment-proof/review')
  @UseGuards(PermissionsGuard)
  @Permissions(PortalPermissions.REQUEST_REVIEW)
  @ApiOperation({ summary: 'Verify or reject a submitted payment proof' })
  reviewPaymentProof(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewPaymentProofDto,
  ) {
    return this.requestsService.reviewPaymentProof(
      user.companyId!,
      id,
      user.id,
      dto,
    );
  }

  @Get('attachments/:id/download')
  @RawResponse()
  @UseGuards(PermissionsGuard)
  @Permissions(PortalPermissions.REQUEST_READ)
  @ApiOperation({ summary: 'Download a portal request attachment (staff)' })
  async downloadAttachment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.requestsService.readCompanyAttachment(
      user.companyId!,
      id,
    );

    response.setHeader('Content-Type', result.attachment.mime_type);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.attachment.original_file_name.replace(/["\r\n]/g, '')}"`,
    );
    response.setHeader('X-Content-Type-Options', 'nosniff');

    return new StreamableFile(result.buffer);
  }
}
