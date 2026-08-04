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

import { CreateCustomerDto } from '../../customers/dto/create-customer.dto';
import { CustomersService } from '../../customers/customers.service';
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

@ApiTags('Intermediary portal')
@ApiBearerAuth('access-token')
@Controller({ path: 'intermediary', version: '1' })
@UseGuards(AuthGuard('jwt'), TenantGuard, PermissionsGuard, PortalGuard)
@Permissions(PortalPermissions.INTERMEDIARY_ACCESS)
@PortalActors(PortalActorType.INTERMEDIARY)
export class IntermediaryPortalController {
  constructor(
    private readonly businessService: PortalBusinessAccessService,
    private readonly dashboardService: PortalDashboardService,
    private readonly customersService: CustomersService,
  ) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get intermediary portal dashboard' })
  dashboard(@CurrentPortalAccount() account: PortalAccount) {
    return this.dashboardService.build(account);
  }

  @Get('profile')
  @ApiOperation({ summary: 'Get intermediary company profile' })
  profile(@CurrentPortalAccount() account: PortalAccount) {
    return this.businessService.findIntermediaryProfile(account);
  }

  @Get('customers')
  @ApiOperation({ summary: 'List intermediary portfolio customers' })
  customers(
    @CurrentPortalAccount() account: PortalAccount,
    @Query() query: PortalListQueryDto,
  ) {
    return this.businessService.findPortfolioCustomers(account, query);
  }

  @Post('customers')
  @ApiOperation({ summary: 'Create a customer under the intermediary company' })
  createCustomer(
    @CurrentPortalAccount() account: PortalAccount,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCustomerDto,
  ) {
    // Never use a company ID supplied in the request body - the customer is
    // created under the intermediary company linked to the portal account.
    return this.customersService.create(
      account.intermediary_company_id!,
      dto,
      user.id,
    );
  }

  @Get('quotations')
  @ApiOperation({ summary: 'List intermediary quotations' })
  quotations(
    @CurrentPortalAccount() account: PortalAccount,
    @Query() query: PortalListQueryDto,
  ) {
    return this.businessService.findQuotations(account, query);
  }

  @Get('quotations/:id')
  @ApiOperation({ summary: 'Get an intermediary quotation' })
  quotation(
    @CurrentPortalAccount() account: PortalAccount,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.businessService.findQuotation(account, id);
  }

  @Post('quotations/drafts')
  @ApiOperation({ summary: 'Create an intermediary quotation draft' })
  createDraft(
    @CurrentPortalAccount() account: PortalAccount,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SaveQuotationDraftDto,
  ) {
    return this.businessService.createQuotationDraft(account, dto, user.id);
  }

  @Put('quotations/drafts/:id')
  @ApiOperation({ summary: 'Update an intermediary quotation draft' })
  updateDraft(
    @CurrentPortalAccount() account: PortalAccount,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateQuotationDraftDto,
  ) {
    return this.businessService.updateQuotationDraft(account, id, dto, user);
  }

  @Post('quotations/drafts/:id/finalize')
  @ApiOperation({
    summary: 'Finalize and submit an intermediary quotation draft',
  })
  finalize(
    @CurrentPortalAccount() account: PortalAccount,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateQuotationDto,
  ) {
    return this.businessService.finalizeQuotation(account, id, dto, user);
  }

  @Get('policies')
  @ApiOperation({ summary: 'List intermediary portfolio policies' })
  policies(
    @CurrentPortalAccount() account: PortalAccount,
    @Query() query: PortalListQueryDto,
  ) {
    return this.businessService.findPolicies(account, query);
  }

  @Get('policies/:id')
  @ApiOperation({ summary: 'Get an intermediary portfolio policy' })
  policy(
    @CurrentPortalAccount() account: PortalAccount,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.businessService.findPolicy(account, id);
  }

  @Get('invoices')
  @ApiOperation({ summary: 'List intermediary portfolio invoices' })
  invoices(
    @CurrentPortalAccount() account: PortalAccount,
    @Query() query: PortalListQueryDto,
  ) {
    return this.businessService.findInvoices(account, query);
  }

  @Get('invoices/:id')
  @ApiOperation({ summary: 'Get an intermediary portfolio invoice' })
  invoice(
    @CurrentPortalAccount() account: PortalAccount,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.businessService.findInvoice(account, id);
  }

  @Get('commissions')
  @ApiOperation({ summary: 'List intermediary commission transactions' })
  commissions(
    @CurrentPortalAccount() account: PortalAccount,
    @Query() query: PortalListQueryDto,
  ) {
    return this.businessService.findCommissions(account, query);
  }

  @Get('receipts')
  @ApiOperation({ summary: 'List receipts connected to intermediary business' })
  receipts(
    @CurrentPortalAccount() account: PortalAccount,
    @Query() query: PortalListQueryDto,
  ) {
    return this.businessService.findReceipts(account, query);
  }
}
