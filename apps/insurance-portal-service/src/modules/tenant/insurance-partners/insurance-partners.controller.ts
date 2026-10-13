import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantScoped } from '@insurance-max/portal-shared';
import { CompanyTypes } from '@insurance-max/portal-shared/decorators/company-types.decorator';
import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import { CompanyType } from '@insurance-max/portal-shared/enums/company-type.enum';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { CompanyTypeGuard } from '@insurance-max/portal-shared/guards/company-type.guard';
import { CreateInsurancePartnerDto } from './dto/create-insurance-partner.dto';
import { ReplacePartnerProductScopesDto } from './dto/replace-partner-product-scopes.dto';
import { PartnerStatusReasonDto } from './dto/partner-status-reason.dto';
import { InsurancePartnersService } from './insurance-partners.service';
import { FindInsurancePartnersQueryDto } from './dto/find-insurance-partners-query.dto';
import { isPagedRequest } from '@insurance-max/portal-shared/dto/table-query.dto';
import {
  ProposePartnerAmendmentDto,
  RespondPartnerAmendmentDto,
} from './dto/propose-partner-amendment.dto';

@ApiTags('Insurance Partners')
@ApiBearerAuth()
@Controller('insurance-partners')
@TenantScoped()
@UseGuards(CompanyTypeGuard)
@CompanyTypes(CompanyType.INSURANCE_COMPANY)
export class InsurancePartnersController {
  constructor(private readonly service: InsurancePartnersService) {}

  @Get(':id/amendments')
  @Permissions('insurance-partners:read')
  amendments(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findAmendments(id, user.companyId);
  }

  @Post(':id/amendments')
  @Permissions('insurance-partners:update')
  proposeAmendment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ProposePartnerAmendmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.proposeAmendment(id, user.companyId, user.id, dto);
  }

  @Patch(':id/amendments/:amendmentId/accept')
  @Permissions('insurance-partners:update')
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
  @Permissions('insurance-partners:update')
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
  @Permissions('insurance-partners:update')
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

  @Get('products')
  @Permissions('insurance-partners:read')
  @ApiOperation({ summary: 'List products that can be granted to partners' })
  products(@CurrentUser() user: AuthenticatedUser) {
    return this.service.findInsurerProducts(user.companyId);
  }

  @Get('branches')
  @Permissions('insurance-partners:read')
  @ApiOperation({
    summary: 'List insurer branches available for partner grants',
  })
  branches(@CurrentUser() user: AuthenticatedUser) {
    return this.service.findInsurerBranches(user.companyId);
  }

  @Get()
  @Permissions('insurance-partners:read')
  @ApiOperation({
    summary: 'List partner relationships for the active insurer',
  })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FindInsurancePartnersQueryDto,
  ) {
    return isPagedRequest(query)
      ? this.service.findPage(user.companyId, query)
      : this.service.findAll(user.companyId);
  }

  @Get(':id')
  @Permissions('insurance-partners:read')
  @ApiOperation({
    summary: 'Get a partner relationship for the active insurer',
  })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findOne(id, user.companyId);
  }

  @Get(':id/product-scopes')
  @Permissions('insurance-partners:read')
  @ApiOperation({ summary: 'List product and action grants for a partner' })
  findProductScopes(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findProductScopes(id, user.companyId);
  }

  @Get(':id/events')
  @Permissions('insurance-partners:read')
  @ApiOperation({
    summary: 'Get the lifecycle history for a partner relationship',
  })
  findEvents(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findEvents(id, user.companyId);
  }

  @Put(':id/product-scopes')
  @Permissions('insurance-partners:update')
  @ApiOperation({ summary: 'Replace product and action grants for a partner' })
  replaceProductScopes(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplacePartnerProductScopesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.replaceProductScopes(id, user.companyId, dto, user.id);
  }

  @Post()
  @Permissions('insurance-partners:create')
  @ApiOperation({ summary: 'Link a partner company to the insurance company' })
  create(
    @Body() dto: CreateInsurancePartnerDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.create(dto, user.companyId, user.id);
  }

  @Patch(':id/approve')
  @Permissions('insurance-partners:approve')
  @ApiOperation({ summary: 'Approve a pending partner relationship' })
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.approve(id, user.companyId, user.id);
  }

  @Patch(':id/reject')
  @Permissions('insurance-partners:approve')
  @ApiOperation({ summary: 'Reject a pending partner relationship request' })
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PartnerStatusReasonDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.reject(id, user.companyId, dto.reason, user.id);
  }

  @Patch(':id/suspend')
  @Permissions('insurance-partners:suspend')
  @ApiOperation({ summary: 'Suspend an active partner relationship' })
  suspend(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PartnerStatusReasonDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.suspend(id, user.companyId, dto.reason, user.id);
  }

  @Patch(':id/reactivate')
  @Permissions('insurance-partners:approve')
  @ApiOperation({ summary: 'Reactivate a suspended partner relationship' })
  reactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.reactivate(id, user.companyId, user.id);
  }

  @Patch(':id/terminate')
  @Permissions('insurance-partners:terminate')
  @ApiOperation({ summary: 'Terminate a partner relationship' })
  terminate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PartnerStatusReasonDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.terminate(id, user.companyId, dto.reason, user.id);
  }
}
