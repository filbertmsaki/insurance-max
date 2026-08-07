import { createHash, randomUUID } from 'node:crypto';

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { IsNull, Repository } from 'typeorm';

import { DocumentRenderService } from './document-render.service';
import { DocumentTemplateVersion } from './entities/document-template-version.entity';
import { DocumentTemplate } from './entities/document-template.entity';

@Injectable()
export class DocumentTemplatesService {
  constructor(
    @InjectRepository(DocumentTemplate)
    private readonly templateRepository: Repository<DocumentTemplate>,
    @InjectRepository(DocumentTemplateVersion)
    private readonly versionRepository: Repository<DocumentTemplateVersion>,
    private readonly renderService: DocumentRenderService,
  ) {}

  listForCompany(companyId: string) {
    return this.templateRepository.find({
      where: [{ company_id: companyId }, { company_id: IsNull() }],
      order: {
        template_name: 'ASC',
      },
    });
  }

  async createTemplate(
    user: AuthenticatedUser,
    input: {
      templateCode: string;
      templateName: string;
      documentType: string;
      engine?: string;
      scope?: string;
    },
  ) {
    const existing = await this.templateRepository.findOne({
      where: {
        company_id: user.companyId!,
        template_code: input.templateCode,
      },
    });

    if (existing) {
      throw new BadRequestException('Template code already exists.');
    }

    return this.templateRepository.save(
      this.templateRepository.create({
        company_id: user.companyId!,
        template_code: input.templateCode,
        template_name: input.templateName,
        document_type: input.documentType,
        engine: input.engine ?? 'TEXT_TEMPLATE',
        scope: input.scope ?? 'COMPANY',
        status: 'DRAFT',
        active_version_id: null,
        created_by: user.id,
      }),
    );
  }

  async findOne(companyId: string, id: string) {
    const template = await this.templateRepository.findOne({
      where: [{ id, company_id: companyId }, { id, company_id: IsNull() }],
    });

    if (!template) {
      throw new NotFoundException('Document template not found.');
    }

    const versions = await this.versionRepository.find({
      where: { template_id: id },
      order: { version_number: 'DESC' },
    });

    return {
      ...template,
      versions,
    };
  }

  async createVersion(
    user: AuthenticatedUser,
    templateId: string,
    input: {
      templateContent: string;
      stylesheetContent?: string;
      headerContent?: string;
      footerContent?: string;
      variableSchema: Record<string, unknown>;
      sampleData?: Record<string, unknown>;
    },
  ) {
    const template = await this.findTemplateForCompany(user.companyId!, templateId);
    const latest = await this.versionRepository.findOne({
      where: { template_id: template.id },
      order: { version_number: 'DESC' },
    });

    return this.versionRepository.save(
      this.versionRepository.create({
        template_id: template.id,
        version_number: (latest?.version_number ?? 0) + 1,
        status: 'DRAFT',
        template_content: input.templateContent,
        stylesheet_content: input.stylesheetContent ?? null,
        header_content: input.headerContent ?? null,
        footer_content: input.footerContent ?? null,
        variable_schema: input.variableSchema,
        sample_data: input.sampleData ?? null,
        template_hash: createHash('sha256')
          .update(input.templateContent)
          .digest('hex'),
        created_by: user.id,
        approved_by: null,
        approved_at: null,
      }),
    );
  }

  async previewVersion(
    user: AuthenticatedUser,
    versionId: string,
    sourceSnapshot?: Record<string, unknown>,
  ) {
    const version = await this.requireVersionForCompany(user.companyId!, versionId);
    const payload = sourceSnapshot ?? version.sample_data ?? {};
    this.renderService.validateVariableSchema(version.variable_schema, payload);

    return {
      rendered: this.renderService.renderTemplate(version.template_content, payload),
      source_snapshot: payload,
      template_hash: version.template_hash,
    };
  }

  async submitApproval(user: AuthenticatedUser, versionId: string) {
    const version = await this.requireVersionForCompany(user.companyId!, versionId);
    version.status = 'SUBMITTED';
    return this.versionRepository.save(version);
  }

  async approve(user: AuthenticatedUser, versionId: string) {
    const version = await this.requireVersionForCompany(user.companyId!, versionId);
    version.status = 'APPROVED';
    version.approved_by = user.id;
    version.approved_at = new Date();
    return this.versionRepository.save(version);
  }

  async publish(user: AuthenticatedUser, versionId: string) {
    const version = await this.requireVersionForCompany(user.companyId!, versionId);
    if (!['APPROVED', 'PUBLISHED'].includes(version.status)) {
      throw new BadRequestException(
        'Template version must be approved before publishing.',
      );
    }

    version.status = 'PUBLISHED';
    await this.versionRepository.save(version);

    const template = await this.findTemplateForCompany(
      user.companyId!,
      version.template_id,
    );
    template.active_version_id = version.id;
    template.status = 'ACTIVE';
    await this.templateRepository.save(template);

    return version;
  }

  async retire(user: AuthenticatedUser, versionId: string) {
    const version = await this.requireVersionForCompany(user.companyId!, versionId);
    version.status = 'RETIRED';
    await this.versionRepository.save(version);

    const template = await this.findTemplateForCompany(
      user.companyId!,
      version.template_id,
    );
    if (template.active_version_id === version.id) {
      template.active_version_id = null;
      template.status = 'DRAFT';
      await this.templateRepository.save(template);
    }

    return version;
  }

  async requireActiveVersion(companyId: string, templateCode: string) {
    const template = await this.templateRepository.findOne({
      where: [
        { company_id: companyId, template_code: templateCode },
        { company_id: IsNull(), template_code: templateCode },
      ],
    });

    if (!template?.active_version_id) {
      throw new NotFoundException('Active document template version not found.');
    }

    const version = await this.versionRepository.findOne({
      where: {
        id: template.active_version_id,
      },
    });

    if (!version) {
      throw new NotFoundException('Active document template version not found.');
    }

    return {
      template,
      version,
    };
  }

  private async findTemplateForCompany(companyId: string, id: string) {
    const template = await this.templateRepository.findOne({
      where: [{ id, company_id: companyId }, { id, company_id: IsNull() }],
    });

    if (!template) {
      throw new NotFoundException('Document template not found.');
    }

    return template;
  }

  private async requireVersionForCompany(companyId: string, id: string) {
    const version = await this.versionRepository.findOne({
      where: { id },
      relations: { template: true },
    });

    if (
      !version ||
      !version.template ||
      (version.template.company_id !== companyId &&
        version.template.company_id !== null)
    ) {
      throw new NotFoundException('Document template version not found.');
    }

    return version;
  }
}
