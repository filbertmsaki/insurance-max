import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
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
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

import {
  SaveQuotationDraftDto,
  UpdateQuotationDraftDto,
} from '../../quotations/dto/quotation-draft.dto';
import { UpdateQuotationDto } from '../../quotations/dto/quotation-payload.dto';
import { MotorVerificationDto } from '../../verifications/dto/verify.dto';
import { VerificationsService } from '../../verifications/verifications.service';
import { CreateCommunicationMessageDto } from '../../communications/dto/communications.dto';

import { CurrentPortalAccount } from '../decorators/current-portal-account.decorator';
import { PortalActors } from '../decorators/portal-actors.decorator';
import { PortalListQueryDto } from '../dto/portal-query.dto';
import { PortalAccount } from '../entities/portal-account.entity';
import { PortalActorType } from '../enums/portal.enums';
import { PortalGuard } from '../guards/portal.guard';
import { PortalBusinessAccessService } from '../services/portal-business-access.service';
import { PortalDashboardService } from '../services/portal-dashboard.service';
import { PortalEngagementService } from '../services/portal-engagement.service';
import { PortalNotificationService } from '../services/portal-notification.service';

// Customer self-service access is authentication-based. PortalGuard still
// resolves the linked portal/customer account and every data read/write below
// remains scoped to that ownership context on the backend.
@ApiTags('Customer portal')
@ApiBearerAuth('access-token')
@Controller({ path: 'customer', version: '1' })
@UseGuards(AuthGuard('jwt'), PortalGuard)
@PortalActors(PortalActorType.CUSTOMER)
export class CustomerPortalController {
  constructor(
    private readonly businessService: PortalBusinessAccessService,
    private readonly dashboardService: PortalDashboardService,
    private readonly engagementService: PortalEngagementService,
    private readonly notificationService: PortalNotificationService,
    private readonly verificationsService: VerificationsService,
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

  @Post('verifications/motor')
  @ApiOperation({ summary: 'Verify a customer motor vehicle with TIRAMIS' })
  verifyMotor(
    @CurrentPortalAccount() account: PortalAccount,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: MotorVerificationDto,
  ) {
    return this.verificationsService.verifyMotor(
      { ...user, companyId: account.company_id },
      dto,
    );
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

  @Get('claims')
  @ApiOperation({ summary: 'List customer claims' })
  claims(
    @CurrentPortalAccount() account: PortalAccount,
    @Query() query: PortalListQueryDto,
  ) {
    return this.businessService.findClaims(account, query);
  }

  @Get('claims/:id')
  @ApiOperation({ summary: 'Get a customer claim' })
  claim(
    @CurrentPortalAccount() account: PortalAccount,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.businessService.findClaim(account, id);
  }

  @Get('complaints')
  @ApiOperation({ summary: 'List customer complaints' })
  complaints(
    @CurrentPortalAccount() account: PortalAccount,
    @Query() query: PortalListQueryDto,
  ) {
    return this.businessService.findComplaints(account, query);
  }

  @Get('complaints/:id')
  @ApiOperation({ summary: 'Get a customer complaint' })
  complaint(
    @CurrentPortalAccount() account: PortalAccount,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.businessService.findComplaint(account, id);
  }

  @Get('documents')
  @ApiOperation({ summary: 'List customer portal documents' })
  documents(
    @CurrentPortalAccount() account: PortalAccount,
    @Query() query: PortalListQueryDto,
  ) {
    return this.engagementService.listDocuments(account, query);
  }

  @Get('documents/:id')
  @ApiOperation({ summary: 'Get a customer portal document' })
  document(
    @CurrentPortalAccount() account: PortalAccount,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.engagementService.findDocument(account, id);
  }

  @Get('documents/:id/download')
  @ApiOperation({ summary: 'Download a customer portal document' })
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
  @ApiOperation({ summary: 'List customer portal notifications' })
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
  @ApiOperation({ summary: 'Mark a customer portal notification as read' })
  markNotificationRead(
    @CurrentPortalAccount() account: PortalAccount,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notificationService.markRead(account.company_id, user.id, id);
  }

  @Get('messages')
  @ApiOperation({ summary: 'List customer communication threads' })
  messages(
    @CurrentPortalAccount() account: PortalAccount,
    @Query() query: PortalListQueryDto,
  ) {
    return this.engagementService.listThreads(account, query);
  }

  @Get('messages/:id')
  @ApiOperation({ summary: 'Get a customer communication thread' })
  messageThread(
    @CurrentPortalAccount() account: PortalAccount,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.engagementService.findThread(account, id);
  }

  @Get('messages/:id/messages')
  @ApiOperation({ summary: 'List customer communication messages' })
  messageHistory(
    @CurrentPortalAccount() account: PortalAccount,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.engagementService.listMessages(account, id);
  }

  @Post('messages/:id/messages')
  @ApiOperation({ summary: 'Reply to a customer communication thread' })
  postMessage(
    @CurrentPortalAccount() account: PortalAccount,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCommunicationMessageDto,
  ) {
    return this.engagementService.postMessage(account, id, dto);
  }

  @Get('signatures')
  @ApiOperation({ summary: 'List customer signature requests' })
  signatures(
    @CurrentPortalAccount() account: PortalAccount,
    @Query() query: PortalListQueryDto,
  ) {
    return this.engagementService.listSignatureRequests(account, query);
  }

  @Get('signatures/:id')
  @ApiOperation({ summary: 'Get a customer signature request' })
  signature(
    @CurrentPortalAccount() account: PortalAccount,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.engagementService.findSignatureRequest(account, id);
  }
}
