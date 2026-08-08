import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import { TenantScoped } from '@insurance-max/portal-shared';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

import {
  CancelSignatureRequestDto,
  CreateSignatureRequestDto,
  PublicSignatureDecisionDto,
} from './dto/document-templates.dto';
import { DocumentsService } from './documents.service';
import { SignatureRequestsService } from './signature-requests.service';

@ApiTags('signature-requests')
@ApiBearerAuth()
@Controller('tenant/signature-requests')
@TenantScoped()
export class SignatureRequestsController {
  constructor(private readonly signatureService: SignatureRequestsService) {}

  @Get()
  @Permissions('signatures:read')
  @ApiOperation({ summary: 'List signature requests' })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.signatureService.listForCompany(user.companyId!);
  }

  @Post()
  @Permissions('signatures:create')
  @ApiOperation({ summary: 'Create a signature request' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSignatureRequestDto,
  ) {
    return this.signatureService.create(user, {
      documentId: dto.document_id,
      signatureProvider: dto.signature_provider,
      signingOrderRequired: dto.signing_order_required,
      expiresAt: dto.expires_at,
      participants: dto.participants.map((participant) => ({
        participantType: participant.participant_type,
        participantId: participant.participant_id,
        name: participant.name,
        email: participant.email,
        phone: participant.phone,
        signingOrder: participant.signing_order,
      })),
    });
  }

  @Get(':id')
  @Permissions('signatures:read')
  @ApiOperation({ summary: 'Get signature request detail' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.signatureService.findOne(user.companyId!, id);
  }

  @Post(':id/send')
  @Permissions('signatures:send')
  @ApiOperation({ summary: 'Send a signature request' })
  send(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.signatureService.send(user, id);
  }

  @Post(':id/remind')
  @Permissions('signatures:remind')
  @ApiOperation({ summary: 'Send a reminder for a signature request' })
  remind(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.signatureService.remind(user, id);
  }

  @Post(':id/cancel')
  @Permissions('signatures:cancel')
  @ApiOperation({ summary: 'Cancel a signature request' })
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelSignatureRequestDto,
  ) {
    return this.signatureService.cancel(user, id, dto.reason);
  }

  @Post(':id/reconcile')
  @Permissions('signatures:reconcile')
  @ApiOperation({ summary: 'Reconcile the current signature state' })
  reconcile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.signatureService.reconcile(user, id);
  }

  @Get(':id/evidence/:evidenceId/verify')
  @Permissions('signatures:read')
  @ApiOperation({ summary: 'Verify signature evidence cryptographic seal' })
  verifyEvidence(
    @CurrentUser() user: AuthenticatedUser,
    @Param('evidenceId', ParseUUIDPipe) evidenceId: string,
  ) {
    return this.signatureService.verifyEvidence(user.companyId!, evidenceId);
  }
}

@ApiTags('public-signatures')
@Controller('signatures')
export class PublicSignatureController {
  constructor(private readonly signatureService: SignatureRequestsService) {}

  @Get(':token')
  @ApiOperation({ summary: 'Resolve a public signature token' })
  findByToken(@Param('token') token: string) {
    return this.signatureService.getPublicParticipant(token);
  }

  @Post(':token/respond')
  @ApiOperation({ summary: 'Submit a public signature decision' })
  respond(
    @Param('token') token: string,
    @Body() dto: PublicSignatureDecisionDto,
    @Req() request: Request,
  ) {
    return this.signatureService.respondPublic(token, {
      decision: dto.decision,
      declineReason: dto.decline_reason,
      name: dto.name,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] ?? null,
    });
  }
}

@ApiTags('public-document-verification')
@Controller('documents/verify')
export class PublicDocumentVerificationController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get(':code')
  @ApiOperation({ summary: 'Verify a public document verification code' })
  verify(@Param('code') code: string) {
    return this.documentsService.verifyPublicDocument(code);
  }
}
