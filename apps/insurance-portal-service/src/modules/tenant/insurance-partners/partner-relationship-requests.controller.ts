import {
  Body,
  Controller,
  Get,
  Patch,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantScoped } from '@insurance-max/portal-shared';
import { CompanyTypes } from '@insurance-max/portal-shared/decorators/company-types.decorator';
import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import { CompanyType } from '@insurance-max/portal-shared/enums/company-type.enum';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { PermissionsGuard } from '@insurance-max/portal-shared/guards/permissions.guard';
import { TenantGuard } from '@insurance-max/portal-shared/guards/tenant.guard';
import { CompanyTypeGuard } from '@insurance-max/portal-shared/guards/company-type.guard';
import { PortalPermissions } from '../portal/portal.permissions';
import { RequestPartnerRelationshipDto } from './dto/request-partner-relationship.dto';
import { PartnerStatusReasonDto } from './dto/partner-status-reason.dto';
import { InsurancePartnersService } from './insurance-partners.service';
import {
  ProposePartnerAmendmentDto,
  RespondPartnerAmendmentDto,
} from './dto/propose-partner-amendment.dto';

@ApiTags('Partner Relationships')
@ApiBearerAuth()
@Controller('partner-relationships')
@TenantScoped()
@UseGuards(AuthGuard('jwt'), TenantGuard, PermissionsGuard, CompanyTypeGuard)
@Permissions(PortalPermissions.INTERMEDIARY_ACCESS)
@CompanyTypes(
  CompanyType.AGENCY,
  CompanyType.BROKER,
  CompanyType.BANCASSURANCE,
  CompanyType.REINSURANCE_COMPANY,
  CompanyType.REINSURANCE_BROKER,
)
export class PartnerRelationshipRequestsController {
  constructor(private readonly service: InsurancePartnersService) {}

  @Get(':id/amendments')
  amendments(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findAmendments(id, user.companyId);
  }

  @Post(':id/amendments')
  proposeAmendment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ProposePartnerAmendmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.proposeAmendment(id, user.companyId, user.id, dto);
  }

  @Patch(':id/amendments/:amendmentId/accept')
  acceptAmendment(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('amendmentId', ParseUUIDPipe) amendmentId: string,
    @Body() dto: RespondPartnerAmendmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.respondToAmendment(
      id,
      amendmentId,
      user.companyId,
      user.id,
      true,
      dto,
    );
  }

  @Patch(':id/amendments/:amendmentId/reject')
  rejectAmendment(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('amendmentId', ParseUUIDPipe) amendmentId: string,
    @Body() dto: RespondPartnerAmendmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.respondToAmendment(
      id,
      amendmentId,
      user.companyId,
      user.id,
      false,
      dto,
    );
  }

  @Patch(':id/amendments/:amendmentId/withdraw')
  withdrawAmendment(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('amendmentId', ParseUUIDPipe) amendmentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.withdrawAmendment(
      id,
      amendmentId,
      user.companyId,
      user.id,
    );
  }

  @Get()
  @ApiOperation({
    summary: 'List insurer appointments for this partner organization',
  })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.service.findIntermediaryRelationships(user.companyId);
  }

  @Get('insurers')
  @ApiOperation({
    summary: 'List verified insurers accepting appointment requests',
  })
  insurers() {
    return this.service.findRelationshipInsurerDirectory();
  }

  @Post('requests')
  @ApiOperation({ summary: 'Request an appointment with an insurer' })
  request(
    @Body() dto: RequestPartnerRelationshipDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.requestRelationship(dto, user.companyId, user.id);
  }

  @Get(':id/events')
  @ApiOperation({
    summary: 'Read the lifecycle history of an insurer relationship',
  })
  events(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findEventsForParticipant(id, user.companyId);
  }

  @Patch(':id/withdraw')
  @ApiOperation({ summary: 'Withdraw a pending insurer appointment request' })
  withdraw(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PartnerStatusReasonDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.withdrawRequest(
      id,
      user.companyId,
      dto.reason,
      user.id,
    );
  }
}
