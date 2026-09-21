import {
  BadRequestException,
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseBoolPipe,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { memoryStorage } from 'multer';

import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { AuthenticatedAccess } from '@insurance-max/portal-shared/decorators/authorization.decorator';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { RawResponse } from '@insurance-max/shared-kernel';

import { CurrentPortalAccount } from '../decorators/current-portal-account.decorator';
import { PortalActors } from '../decorators/portal-actors.decorator';
import {
  CreateClaimNotificationDto,
  CreatePaymentProofDto,
  CreatePortalComplaintDto,
  CreatePolicyPortalRequestDto,
  CreateQuotationAssistanceDto,
  PortalRequestFilterDto,
  UploadPortalAttachmentDto,
} from '../dto/portal-request.dto';
import { PortalAccount } from '../entities/portal-account.entity';
import { PortalActorType } from '../enums/portal.enums';
import { PortalGuard } from '../guards/portal.guard';
import type { PortalUploadFile } from '../services/portal-file-storage.service';
import { ComplaintsService } from '../../claims/complaints.service';
import { PortalBusinessAccessService } from '../services/portal-business-access.service';
import { PortalNotificationService } from '../services/portal-notification.service';
import { PortalRequestsService } from '../services/portal-requests.service';

@ApiTags('Portal requests and notifications')
@ApiBearerAuth('access-token')
@Controller({ path: 'portal', version: '1' })
@UseGuards(AuthGuard('jwt'), PortalGuard)
@PortalActors(PortalActorType.CUSTOMER, PortalActorType.INTERMEDIARY)
export class PortalCommonController {
  constructor(
    private readonly requestsService: PortalRequestsService,
    private readonly notificationService: PortalNotificationService,
    private readonly businessService: PortalBusinessAccessService,
    private readonly complaintsService: ComplaintsService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Get the authenticated portal account' })
  me(@CurrentPortalAccount() account: PortalAccount) {
    return {
      id: account.id,
      actor_type: account.actor_type,
      status: account.status,
      company_id: account.company_id,
      customer: account.customer
        ? {
            id: account.customer.id,
            customer_no: account.customer.customer_no,
            customer_type: account.customer.customer_type,
          }
        : null,
      intermediary_company: account.intermediary_company
        ? {
            id: account.intermediary_company.id,
            name: account.intermediary_company.name,
            company_type: account.intermediary_company.company_type,
          }
        : null,
      activated_at: account.activated_at,
      last_accessed_at: account.last_accessed_at,
    };
  }

  @Post('requests/policy')
  @AuthenticatedAccess()
  @ApiOperation({
    summary: 'Submit an endorsement, cancellation, or renewal request',
  })
  createPolicyRequest(
    @CurrentPortalAccount() account: PortalAccount,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePolicyPortalRequestDto,
  ) {
    return this.requestsService.createPolicyRequest(account, user.id, dto);
  }

  @Post('requests/claims')
  @AuthenticatedAccess()
  @ApiOperation({ summary: 'Submit a claim notification' })
  createClaim(
    @CurrentPortalAccount() account: PortalAccount,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateClaimNotificationDto,
  ) {
    return this.requestsService.createClaimNotification(account, user.id, dto);
  }

  @Post('complaints')
  @AuthenticatedAccess()
  @ApiOperation({ summary: 'Submit a customer complaint' })
  async createComplaint(
    @CurrentPortalAccount() account: PortalAccount,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePortalComplaintDto,
  ) {
    const scopedClaim = dto.claim_id
      ? await this.businessService.findClaim(account, dto.claim_id)
      : null;
    const scopedPolicy = dto.policy_id
      ? await this.businessService.assertPolicy(account, dto.policy_id)
      : null;

    const customerId =
      account.actor_type === PortalActorType.CUSTOMER
        ? account.customer_id!
        : (scopedClaim?.customer_id ??
          scopedPolicy?.customer_id ??
          dto.customer_id);

    if (!customerId) {
      throw new BadRequestException(
        'Customer is required for intermediary complaints',
      );
    }

    if (account.actor_type === PortalActorType.INTERMEDIARY && !scopedPolicy) {
      await this.businessService.assertPortfolioCustomer(account, customerId);
    }

    return this.complaintsService.create(
      {
        ...user,
        companyId: account.company_id,
        activeBranchId: user.activeBranchId ?? null,
      },
      {
        claim_id: dto.claim_id,
        policy_id: dto.policy_id ?? scopedClaim?.policy_id ?? undefined,
        customer_id: customerId,
        category: dto.category,
        subject: dto.subject,
        description: dto.description,
        priority: dto.priority,
        reported_channel: 'PORTAL',
      },
    );
  }

  @Post('requests/quotation-assistance')
  @AuthenticatedAccess()
  @ApiOperation({ summary: 'Request assistance with a quotation' })
  createQuotationAssistance(
    @CurrentPortalAccount() account: PortalAccount,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateQuotationAssistanceDto,
  ) {
    return this.requestsService.createQuotationAssistance(
      account,
      user.id,
      dto,
    );
  }

  @Post('requests/payment-proofs')
  @AuthenticatedAccess()
  @ApiOperation({
    summary: 'Submit manual payment information for finance review',
  })
  createPaymentProof(
    @CurrentPortalAccount() account: PortalAccount,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePaymentProofDto,
  ) {
    return this.requestsService.createPaymentProof(account, user.id, dto);
  }

  @Get('requests')
  @ApiOperation({ summary: 'List the authenticated portal account requests' })
  requests(
    @CurrentPortalAccount() account: PortalAccount,
    @Query() query: PortalRequestFilterDto,
  ) {
    return this.requestsService.findMine(account, query);
  }

  @Get('requests/:id')
  @ApiOperation({ summary: 'Get a portal service request' })
  request(
    @CurrentPortalAccount() account: PortalAccount,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.requestsService.findMineOne(account, id);
  }

  @Post('requests/:id/cancel')
  @AuthenticatedAccess()
  @ApiOperation({ summary: 'Cancel an eligible portal request' })
  cancel(
    @CurrentPortalAccount() account: PortalAccount,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.requestsService.cancelMine(account, user.id, id);
  }

  @Post('requests/:id/resubmit')
  @AuthenticatedAccess()
  @ApiOperation({
    summary: 'Resubmit a request after supplying additional information',
  })
  resubmit(
    @CurrentPortalAccount() account: PortalAccount,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.requestsService.resubmitMine(account, user.id, id);
  }

  @Post('requests/:id/attachments')
  @AuthenticatedAccess()
  @ApiOperation({ summary: 'Upload a supporting document to a portal request' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['document_type', 'file'],
      properties: {
        document_type: { type: 'string', example: 'PAYMENT_PROOF' },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      // memoryStorage() is required: PortalUploadFile.buffer must be
      // populated, and Nest/multer default to disk storage (which sets
      // `path`, not `buffer`) when no storage engine is specified.
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024, files: 1 },
    }),
  )
  upload(
    @CurrentPortalAccount() account: PortalAccount,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UploadPortalAttachmentDto,
    @UploadedFile() file: PortalUploadFile,
  ) {
    return this.requestsService.uploadAttachment(
      account,
      user.id,
      id,
      dto.document_type,
      file,
    );
  }

  @Get('attachments/:id/download')
  @RawResponse()
  @ApiOperation({
    summary: 'Download an attachment owned by the portal account',
  })
  async download(
    @CurrentPortalAccount() account: PortalAccount,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.requestsService.readMineAttachment(account, id);

    const safeFileName = result.attachment.original_file_name.replace(
      /["\r\n]/g,
      '',
    );

    response.setHeader('Content-Type', result.attachment.mime_type);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${safeFileName}"`,
    );
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'private, no-store');

    return new StreamableFile(result.buffer);
  }

  @Get('notifications')
  @ApiOperation({ summary: 'List portal notifications' })
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
  @AuthenticatedAccess()
  @ApiOperation({ summary: 'Mark a portal notification as read' })
  markRead(
    @CurrentPortalAccount() account: PortalAccount,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notificationService.markRead(account.company_id, user.id, id);
  }
}
