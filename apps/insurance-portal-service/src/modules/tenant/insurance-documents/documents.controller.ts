import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import { TenantScoped } from '@insurance-max/portal-shared';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

import {
  RegisterDocumentDto,
  RejectDocumentDto,
} from './dto/register-document.dto';
import { DocumentsPermissions } from './documents.permissions';
import { DocumentsService } from './documents.service';

@ApiTags('documents')
@ApiBearerAuth()
@Controller('tenant/documents')
@TenantScoped()
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
  @Permissions(DocumentsPermissions.REGISTER)
  @ApiOperation({ summary: 'Register an uploaded document in the controlled document registry' })
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
  @Permissions(DocumentsPermissions.REGISTER)
  @ApiOperation({ summary: 'Get a registered document by ID' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.documentsService.findOne(user.companyId!, id);
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
