import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import { PermissionsGuard } from '@insurance-max/portal-shared/guards/permissions.guard';
import { TenantGuard } from '@insurance-max/portal-shared/guards/tenant.guard';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

import {
  SaveQuotationDraftDto,
  UpdateQuotationDraftDto,
} from '../../quotations/dto/quotation-draft.dto';
import { UpdateQuotationDto } from '../../quotations/dto/quotation-payload.dto';

import { CurrentPortalAccount } from '../decorators/current-portal-account.decorator';
import { PortalActors } from '../decorators/portal-actors.decorator';
import { PortalListQueryDto } from '../dto/portal-query.dto';
import { PortalAccount } from '../entities/portal-account.entity';
import { PortalActorType } from '../enums/portal.enums';
import { PortalGuard } from '../guards/portal.guard';
import { PortalPermissions } from '../portal.permissions';
import { PortalBusinessAccessService } from '../services/portal-business-access.service';
import { PortalDashboardService } from '../services/portal-dashboard.service';

// Every route in this controller requires the same single permission, so
// PermissionsGuard + @Permissions() are applied once at class level rather
// than repeated per method (unlike PortalAdminController, whose routes each
// need a different permission).
@ApiTags('Customer portal')
@ApiBearerAuth('access-token')
@Controller({ path: 'customer', version: '1' })
@UseGuards(AuthGuard('jwt'), TenantGuard, PermissionsGuard, PortalGuard)
@Permissions(PortalPermissions.CUSTOMER_ACCESS)
@PortalActors(PortalActorType.CUSTOMER)
export class CustomerPortalController {
  constructor(
    private readonly businessService: PortalBusinessAccessService,
    private readonly dashboardService: PortalDashboardService,
  ) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get customer portal dashboard' })
  dashboard(@CurrentPortalAccount() account: PortalAccount) {
    return this.dashboardService.build(account);
  }

  @Get('profile')
  @ApiOperation({ summary: 'Get linked customer profile' })
  profile(@CurrentPortalAccount() account: PortalAccount) {
    return this.businessService.findCustomerProfile(account);
  }

  @Get('quotations')
  @ApiOperation({ summary: 'List customer quotations' })
  quotations(
    @CurrentPortalAccount() account: PortalAccount,
    @Query() query: PortalListQueryDto,
  ) {
    return this.businessService.findQuotations(account, query);
  }

  @Get('quotations/:id')
  @ApiOperation({ summary: 'Get a customer quotation' })
  quotation(
    @CurrentPortalAccount() account: PortalAccount,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.businessService.findQuotation(account, id);
  }

  @Post('quotations/drafts')
  @ApiOperation({ summary: 'Create a customer quotation draft' })
  createDraft(
    @CurrentPortalAccount() account: PortalAccount,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SaveQuotationDraftDto,
  ) {
    return this.businessService.createQuotationDraft(account, dto, user.id);
  }

  @Put('quotations/drafts/:id')
  @ApiOperation({ summary: 'Update a customer quotation draft' })
  updateDraft(
    @CurrentPortalAccount() account: PortalAccount,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateQuotationDraftDto,
  ) {
    return this.businessService.updateQuotationDraft(account, id, dto, user);
  }

  @Post('quotations/drafts/:id/finalize')
  @ApiOperation({ summary: 'Finalize and submit a customer quotation draft' })
  finalize(
    @CurrentPortalAccount() account: PortalAccount,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateQuotationDto,
  ) {
    return this.businessService.finalizeQuotation(account, id, dto, user);
  }

  @Get('policies')
  @ApiOperation({ summary: 'List customer policies' })
  policies(
    @CurrentPortalAccount() account: PortalAccount,
    @Query() query: PortalListQueryDto,
  ) {
    return this.businessService.findPolicies(account, query);
  }

  @Get('policies/:id')
  @ApiOperation({ summary: 'Get a customer policy' })
  policy(
    @CurrentPortalAccount() account: PortalAccount,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.businessService.findPolicy(account, id);
  }

  @Get('invoices')
  @ApiOperation({ summary: 'List customer invoices' })
  invoices(
    @CurrentPortalAccount() account: PortalAccount,
    @Query() query: PortalListQueryDto,
  ) {
    return this.businessService.findInvoices(account, query);
  }

  @Get('invoices/:id')
  @ApiOperation({ summary: 'Get a customer invoice' })
  invoice(
    @CurrentPortalAccount() account: PortalAccount,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.businessService.findInvoice(account, id);
  }

  @Get('receipts')
  @ApiOperation({ summary: 'List customer receipts' })
  receipts(
    @CurrentPortalAccount() account: PortalAccount,
    @Query() query: PortalListQueryDto,
  ) {
    return this.businessService.findReceipts(account, query);
  }
}
