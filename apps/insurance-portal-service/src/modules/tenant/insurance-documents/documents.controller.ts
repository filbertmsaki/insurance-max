import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Request, Response } from 'express';
import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import { AnyPermissions, TenantScoped } from '@insurance-max/portal-shared';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

import {
  CreateUploadSessionDto,
  RegisterDocumentDto,
  RejectDocumentDto,
  RevokeDocumentDto,
  ShareDocumentDto,
} from './dto/register-document.dto';
import { GenerateDocumentDto } from './dto/document-templates.dto';
import type { UploadedDocumentFile } from './document-storage.service';
import { DocumentGenerationService } from './document-generation.service';
import { DocumentsPermissions } from './documents.permissions';
import { DocumentsService } from './documents.service';

@ApiTags('documents')
@ApiBearerAuth()
@Controller('tenant/documents')
@TenantScoped()
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly generationService: DocumentGenerationService,
  ) {}

  @Get()
  @AnyPermissions(DocumentsPermissions.READ, DocumentsPermissions.REGISTER)
  @ApiOperation({ summary: 'List documents in the engagement document centre' })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.documentsService.listForCompany(user.companyId!);
  }

  @Post()
  @AnyPermissions(DocumentsPermissions.UPLOAD, DocumentsPermissions.REGISTER)
  @ApiOperation({
    summary: 'Register a legacy document record without file content',
  })
  register(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RegisterDocumentDto,
  ) {
    return this.documentsService.register(user, {
      ownerType: dto.owner_type,
      ownerId: dto.owner_id,
      fileName: dto.file_name,
      checksum: dto.checksum,
      contentType: dto.content_type,
      fileSize: dto.file_size,
    });
  }

  @Get(':id')
  @AnyPermissions(DocumentsPermissions.READ, DocumentsPermissions.REGISTER)
  @ApiOperation({ summary: 'Get document detail' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.documentsService.findOne(user.companyId!, id);
  }

  @Get(':id/versions')
  @AnyPermissions(DocumentsPermissions.READ, DocumentsPermissions.REGISTER)
  @ApiOperation({ summary: 'List versions for a document' })
  versions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.documentsService.listVersions(user.companyId!, id);
  }

  @Get(':id/links')
  @AnyPermissions(DocumentsPermissions.READ, DocumentsPermissions.REGISTER)
  @ApiOperation({ summary: 'List linked records for a document' })
  links(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.documentsService.listLinks(user.companyId!, id);
  }

  @Get(':id/access-history')
  @AnyPermissions(
    DocumentsPermissions.READ_ACCESS_HISTORY,
    DocumentsPermissions.READ,
  )
  @ApiOperation({ summary: 'List document download access history' })
  accessHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.documentsService.listAccessHistory(user.companyId!, id);
  }

  @Post('upload-sessions')
  @AnyPermissions(DocumentsPermissions.UPLOAD, DocumentsPermissions.REGISTER)
  @ApiOperation({ summary: 'Create a secure upload session for a document' })
  createUploadSession(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateUploadSessionDto,
  ) {
    return this.documentsService.createUploadSession(user, {
      title: dto.title,
      documentType: dto.document_type,
      classification: dto.classification,
      resourceType: dto.resource_type,
      resourceId: dto.resource_id,
      maximumBytes: dto.maximum_bytes,
      allowedMimeTypes: dto.allowed_mime_types,
      customerVisible: dto.customer_visible,
      intermediaryVisible: dto.intermediary_visible,
      linkType: dto.link_type,
      linkLabel: dto.link_label,
    });
  }

  @Post('upload-sessions/:token/complete')
  @AnyPermissions(DocumentsPermissions.UPLOAD, DocumentsPermissions.REGISTER)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Complete a secure document upload session' })
  completeUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Param('token') token: string,
    @UploadedFile() file: UploadedDocumentFile,
  ) {
    return this.documentsService.completeUpload(user, token, file);
  }

  @Post('generate')
  @AnyPermissions(
    DocumentsPermissions.UPLOAD,
    DocumentsPermissions.CREATE_VERSION,
  )
  @ApiOperation({
    summary: 'Generate a document from an active template version',
  })
  generate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: GenerateDocumentDto,
  ) {
    return this.generationService.request(user, {
      templateCode: dto.template_code,
      documentType: dto.document_type,
      title: dto.title,
      sourceSnapshot: dto.source_snapshot,
      resourceType: dto.resource_type,
      resourceId: dto.resource_id,
      customerVisible: dto.customer_visible ?? false,
      intermediaryVisible: dto.intermediary_visible ?? false,
      publicVerificationEnabled: dto.public_verification_enabled ?? false,
      idempotencyKey: dto.idempotency_key,
    });
  }

  @Post(':id/create-version')
  @AnyPermissions(
    DocumentsPermissions.CREATE_VERSION,
    DocumentsPermissions.UPLOAD,
  )
  @ApiOperation({
    summary: 'Create a new upload session for a replacement version',
  })
  createVersion(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.documentsService.createVersionUploadSession(user, id);
  }

  @Post(':id/share')
  @AnyPermissions(
    DocumentsPermissions.SHARE_CUSTOMER,
    DocumentsPermissions.SHARE_INTERMEDIARY,
  )
  @ApiOperation({ summary: 'Share a document with a linked record audience' })
  share(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ShareDocumentDto,
  ) {
    return this.documentsService.share(user, id, {
      customerVisible: dto.customer_visible,
      intermediaryVisible: dto.intermediary_visible,
      publicVerificationEnabled: dto.public_verification_enabled,
      linkType: dto.link_type,
      linkedRecordType: dto.linked_record_type,
      linkedRecordId: dto.linked_record_id,
      label: dto.label,
    });
  }

  @Post(':id/revoke')
  @AnyPermissions(DocumentsPermissions.REVOKE, DocumentsPermissions.ARCHIVE)
  @ApiOperation({ summary: 'Revoke document sharing or remove a link' })
  revoke(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RevokeDocumentDto,
  ) {
    return this.documentsService.revoke(user, id, dto.link_id);
  }

  @Post(':id/archive')
  @Permissions(DocumentsPermissions.ARCHIVE)
  @ApiOperation({ summary: 'Archive a document' })
  archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.documentsService.archive(user, id);
  }

  @Post(':id/restore')
  @Permissions(DocumentsPermissions.ARCHIVE)
  @ApiOperation({ summary: 'Restore an archived document' })
  restore(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.documentsService.restore(user, id);
  }

  @Post(':id/rescan')
  @Permissions(DocumentsPermissions.RESCAN)
  @ApiOperation({
    summary: 'Run a new security scan against the current document version',
  })
  rescan(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.documentsService.rescan(user, id);
  }

  @Get(':id/download')
  @AnyPermissions(DocumentsPermissions.DOWNLOAD, DocumentsPermissions.READ)
  @ApiOperation({ summary: 'Download the current version of a document' })
  async download(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const file = await this.documentsService.download(user.companyId!, id, {
      actorId: user.id,
      actorType: 'USER',
      accessChannel: 'INTERNAL_API',
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] ?? null,
    });

    response.setHeader('Content-Type', file.mimeType);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.fileName.replace(/"/g, '')}"`,
    );

    return file.buffer;
  }

  @Post(':id/verify')
  @Permissions(DocumentsPermissions.VERIFY)
  @ApiOperation({ summary: 'Mark a registered document as verified' })
  verify(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.documentsService.verify(user, id);
  }

  @Post(':id/reject')
  @Permissions(DocumentsPermissions.REJECT)
  @ApiOperation({ summary: 'Reject a registered document' })
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectDocumentDto,
  ) {
    return this.documentsService.reject(user, id, dto.reason);
  }
}
