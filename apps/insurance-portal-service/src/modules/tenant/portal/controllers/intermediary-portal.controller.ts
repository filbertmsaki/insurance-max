import {
  Body,
  Controller,
  Delete,
  DefaultValuePipe,
  ForbiddenException,
  Get,
  Param,
  Patch,
  ParseBoolPipe,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  Put,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import { PermissionsGuard } from '@insurance-max/portal-shared/guards/permissions.guard';
import { TenantGuard } from '@insurance-max/portal-shared/guards/tenant.guard';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { DataScopePermissions } from '../../../shared/authorization/data-scope.constants';

import { CreateCustomerDto } from '../../customers/dto/create-customer.dto';
import { UpdateCustomerDto } from '../../customers/dto/update-customer.dto';
import { CustomersService } from '../../customers/customers.service';
import { CreateCommunicationMessageDto } from '../../communications/dto/communications.dto';
import {
  SaveQuotationDraftDto,
  UpdateQuotationDraftDto,
} from '../../quotations/dto/quotation-draft.dto';
import { UpdateQuotationDto } from '../../quotations/dto/quotation-payload.dto';
import { QuotationsService } from '../../quotations/quotations.service';

import { CurrentPortalAccount } from '../decorators/current-portal-account.decorator';
import { PortalActors } from '../decorators/portal-actors.decorator';
import { PortalListQueryDto } from '../dto/portal-query.dto';
import { PortalAccount } from '../entities/portal-account.entity';
import { PortalActorType } from '../enums/portal.enums';
import { PortalGuard } from '../guards/portal.guard';
import { PortalPermissions } from '../portal.permissions';
import { PortalBusinessAccessService } from '../services/portal-business-access.service';
import { PortalDashboardService } from '../services/portal-dashboard.service';
import { PortalEngagementService } from '../services/portal-engagement.service';
import { PortalNotificationService } from '../services/portal-notification.service';

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
    private readonly engagementService: PortalEngagementService,
    private readonly notificationService: PortalNotificationService,
    private readonly quotationsService: QuotationsService,
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

  @Get('customers/:id')
  @ApiOperation({ summary: 'Get an intermediary portfolio customer' })
  async customer(
    @CurrentPortalAccount() account: PortalAccount,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.businessService.assertPortfolioCustomer(account, id);
  }

  @Patch('customers/:id')
  @ApiOperation({
    summary: 'Update a customer owned by the intermediary company',
  })
  updateCustomer(
    @CurrentPortalAccount() account: PortalAccount,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customersService.updateForUser(
      this.intermediaryCustomerUser(account, user),
      id,
      dto,
    );
  }

  @Delete('customers/:id')
  @ApiOperation({
    summary: 'Archive a customer owned by the intermediary company',
  })
  async removeCustomer(
    @CurrentPortalAccount() account: PortalAccount,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.customersService.removeForUser(
      this.intermediaryCustomerUser(account, user),
      id,
    );

    return { message: 'Customer archived successfully' };
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

  @Delete('quotations/drafts/:id')
  @ApiOperation({ summary: 'Delete an intermediary quotation draft' })
  async deleteDraft(
    @CurrentPortalAccount() account: PortalAccount,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.businessService.assertQuotation(account, id);
    await this.quotationsService.removeDraft(account.company_id, id);

    return { message: 'Quotation draft deleted successfully' };
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

  @Get('claims')
  @ApiOperation({ summary: 'List intermediary portfolio claims' })
  claims(
    @CurrentPortalAccount() account: PortalAccount,
    @Query() query: PortalListQueryDto,
  ) {
    return this.businessService.findClaims(account, query);
  }

  @Get('claims/:id')
  @ApiOperation({ summary: 'Get an intermediary portfolio claim' })
  claim(
    @CurrentPortalAccount() account: PortalAccount,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.businessService.findClaim(account, id);
  }

  @Get('complaints')
  @ApiOperation({ summary: 'List intermediary portfolio complaints' })
  complaints(
    @CurrentPortalAccount() account: PortalAccount,
    @Query() query: PortalListQueryDto,
  ) {
    return this.businessService.findComplaints(account, query);
  }

  @Get('complaints/:id')
  @ApiOperation({ summary: 'Get an intermediary portfolio complaint' })
  complaint(
    @CurrentPortalAccount() account: PortalAccount,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.businessService.findComplaint(account, id);
  }

  @Get('documents')
  @ApiOperation({ summary: 'List intermediary portal documents' })
  documents(
    @CurrentPortalAccount() account: PortalAccount,
    @Query() query: PortalListQueryDto,
  ) {
    return this.engagementService.listDocuments(account, query);
  }

  @Get('documents/:id')
  @ApiOperation({ summary: 'Get an intermediary portal document' })
  document(
    @CurrentPortalAccount() account: PortalAccount,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.engagementService.findDocument(account, id);
  }

  @Get('documents/:id/download')
  @ApiOperation({ summary: 'Download an intermediary portal document' })
  async downloadDocument(
    @CurrentPortalAccount() account: PortalAccount,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const file = await this.engagementService.downloadDocument(account, id, {
      actorId: user.id,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] ?? null,
    });

    response.setHeader('Content-Type', file.mimeType);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.fileName.replace(/"/g, '')}"`,
    );
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'private, no-store');

    return new StreamableFile(file.buffer);
  }

  @Get('notifications')
  @ApiOperation({ summary: 'List intermediary portal notifications' })
  notifications(
    @CurrentPortalAccount() account: PortalAccount,
    @CurrentUser() user: AuthenticatedUser,
    @Query('unread_only', new DefaultValuePipe(false), ParseBoolPipe)
    unreadOnly: boolean,
  ) {
    return this.notificationService.findMine(
      account.company_id,
      user.id,
      unreadOnly,
    );
  }

  @Post('notifications/:id/read')
  @ApiOperation({ summary: 'Mark an intermediary portal notification as read' })
  markNotificationRead(
    @CurrentPortalAccount() account: PortalAccount,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notificationService.markRead(account.company_id, user.id, id);
  }

  @Get('messages')
  @ApiOperation({ summary: 'List intermediary communication threads' })
  messages(
    @CurrentPortalAccount() account: PortalAccount,
    @Query() query: PortalListQueryDto,
  ) {
    return this.engagementService.listThreads(account, query);
  }

  @Get('messages/:id')
  @ApiOperation({ summary: 'Get an intermediary communication thread' })
  messageThread(
    @CurrentPortalAccount() account: PortalAccount,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.engagementService.findThread(account, id);
  }

  @Get('messages/:id/messages')
  @ApiOperation({ summary: 'List intermediary communication messages' })
  messageHistory(
    @CurrentPortalAccount() account: PortalAccount,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.engagementService.listMessages(account, id);
  }

  @Post('messages/:id/messages')
  @ApiOperation({ summary: 'Reply to an intermediary communication thread' })
  postMessage(
    @CurrentPortalAccount() account: PortalAccount,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCommunicationMessageDto,
  ) {
    return this.engagementService.postMessage(account, id, dto);
  }

  @Get('signatures')
  @ApiOperation({ summary: 'List intermediary signature requests' })
  signatures(
    @CurrentPortalAccount() account: PortalAccount,
    @Query() query: PortalListQueryDto,
  ) {
    return this.engagementService.listSignatureRequests(account, query);
  }

  @Get('signatures/:id')
  @ApiOperation({ summary: 'Get an intermediary signature request' })
  signature(
    @CurrentPortalAccount() account: PortalAccount,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.engagementService.findSignatureRequest(account, id);
  }

  private intermediaryCustomerUser(
    account: PortalAccount,
    user: AuthenticatedUser,
  ): AuthenticatedUser {
    if (!account.intermediary_company_id || !account.intermediary_company) {
      throw new ForbiddenException('Intermediary company context is missing');
    }

    return {
      ...user,
      scope: 'company',
      companyId: account.intermediary_company_id,
      companyType: account.intermediary_company.company_type,
      companyMembershipId: account.id,
      permissions: [
        ...(user.permissions ?? []),
        DataScopePermissions.COMPANY_ALL,
      ],
    };
  }
}
