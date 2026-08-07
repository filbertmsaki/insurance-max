import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import { TenantScoped } from '@insurance-max/portal-shared';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

import {
  CreateDocumentTemplateDto,
  CreateDocumentTemplateVersionDto,
  PreviewDocumentTemplateVersionDto,
} from './dto/document-templates.dto';
import { DocumentTemplatesService } from './document-templates.service';

@ApiTags('document-templates')
@ApiBearerAuth()
@Controller('tenant/document-templates')
@TenantScoped()
export class DocumentTemplatesController {
  constructor(private readonly templatesService: DocumentTemplatesService) {}

  @Get()
  @Permissions('document-templates:read')
  @ApiOperation({ summary: 'List document templates' })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.templatesService.listForCompany(user.companyId!);
  }

  @Post()
  @Permissions('document-templates:create')
  @ApiOperation({ summary: 'Create a document template' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDocumentTemplateDto,
  ) {
    return this.templatesService.createTemplate(user, {
      templateCode: dto.template_code,
      templateName: dto.template_name,
      documentType: dto.document_type,
      engine: dto.engine,
      scope: dto.scope,
    });
  }

  @Get(':id')
  @Permissions('document-templates:read')
  @ApiOperation({ summary: 'Get template detail including versions' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.templatesService.findOne(user.companyId!, id);
  }

  @Post(':id/versions')
  @Permissions('document-templates:update-draft')
  @ApiOperation({ summary: 'Create a document template version' })
  createVersion(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateDocumentTemplateVersionDto,
  ) {
    return this.templatesService.createVersion(user, id, {
      templateContent: dto.template_content,
      stylesheetContent: dto.stylesheet_content,
      headerContent: dto.header_content,
      footerContent: dto.footer_content,
      variableSchema: dto.variable_schema,
      sampleData: dto.sample_data,
    });
  }
}

@ApiTags('document-template-versions')
@ApiBearerAuth()
@Controller('tenant/document-template-versions')
@TenantScoped()
export class DocumentTemplateVersionsController {
  constructor(private readonly templatesService: DocumentTemplatesService) {}

  @Post(':id/preview')
  @Permissions('document-templates:read')
  @ApiOperation({ summary: 'Preview a document template version' })
  preview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PreviewDocumentTemplateVersionDto,
  ) {
    return this.templatesService.previewVersion(user, id, dto.source_snapshot);
  }

  @Post(':id/submit-approval')
  @Permissions('document-templates:update-draft')
  @ApiOperation({ summary: 'Submit a template version for approval' })
  submitApproval(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.templatesService.submitApproval(user, id);
  }

  @Post(':id/approve')
  @Permissions('document-templates:approve')
  @ApiOperation({ summary: 'Approve a template version' })
  approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.templatesService.approve(user, id);
  }

  @Post(':id/publish')
  @Permissions('document-templates:publish')
  @ApiOperation({ summary: 'Publish a template version' })
  publish(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.templatesService.publish(user, id);
  }

  @Post(':id/retire')
  @Permissions('document-templates:retire')
  @ApiOperation({ summary: 'Retire a template version' })
  retire(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.templatesService.retire(user, id);
  }
}
