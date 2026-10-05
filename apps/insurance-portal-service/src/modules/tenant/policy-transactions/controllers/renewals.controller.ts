import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import { TenantScoped } from '@insurance-max/portal-shared';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

import { LinkRenewalQuotationDto } from '../dto/link-renewal-quotation.dto';
import { ReasonDto } from '../dto/reason.dto';
import { RenewalService } from '../services/renewal.service';

@ApiTags('renewals')
@ApiBearerAuth()
@Controller()
@TenantScoped()
export class RenewalsController {
  constructor(private readonly renewalService: RenewalService) {}

  @Get('tenant/policies/:policyId/renewal-eligibility')
  @Permissions('renewals:create')
  @ApiOperation({ summary: 'Check whether a policy can be renewed' })
  eligibility(
    @CurrentUser() user: AuthenticatedUser,
    @Param('policyId', ParseUUIDPipe) policyId: string,
  ) {
    return this.renewalService.getEligibility(user, policyId);
  }

  @Get('tenant/renewals')
  @Permissions('renewals:read')
  @ApiOperation({ summary: 'List renewal offers for the current company' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('policy_id') policyId?: string,
  ) {
    return this.renewalService.findAll(user.companyId!, policyId, user);
  }

  @Get('tenant/renewals/:id/context')
  @Permissions('renewals:read')
  @ApiOperation({
    summary: 'Get a renewal with its source policy and quotation',
  })
  context(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.renewalService.findContext(user.companyId!, id, user);
  }

  @Post('tenant/renewals/:id/create-offer')
  @Permissions('renewals:create-offer')
  @ApiOperation({ summary: 'Create the prefilled renewal quotation' })
  createOffer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.renewalService.createRenewalOffer(user, id);
  }

  @Post('tenant/renewals/:id/link-quotation')
  @Permissions('renewals:create-offer')
  @ApiOperation({
    summary:
      'Link a renewal offer to a quotation created through the normal quotation flow',
  })
  linkQuotation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LinkRenewalQuotationDto,
  ) {
    return this.renewalService.linkQuotation(user, id, dto.quotation_id);
  }

  @Post('tenant/renewals/:id/send-offer')
  @Permissions('renewals:send-offer')
  @ApiOperation({ summary: 'Mark a renewal offer as sent to the customer' })
  sendOffer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.renewalService.sendOffer(user, id);
  }

  @Post('tenant/renewals/:id/accept')
  @Permissions('renewals:accept')
  @ApiOperation({ summary: 'Record customer acceptance of a renewal offer' })
  accept(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.renewalService.accept(user, id);
  }

  @Post('tenant/renewals/:id/decline')
  @Permissions('renewals:decline')
  @ApiOperation({ summary: 'Record customer decline of a renewal offer' })
  decline(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
  ) {
    return this.renewalService.decline(user, id, dto.reason);
  }

  @Post('tenant/policies/:policyId/renewals')
  @Permissions('renewals:create')
  @ApiOperation({
    summary:
      'Manually create a renewal offer for a policy ahead of the scheduled job',
  })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('policyId', ParseUUIDPipe) policyId: string,
  ) {
    return this.renewalService.createEligibleRenewalForPolicy(
      user.companyId!,
      policyId,
      user.id,
      user,
    );
  }
}
