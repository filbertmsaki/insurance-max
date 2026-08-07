import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { Repository } from 'typeorm';
import {
  DocumentClassification,
  DocumentLinkType,
  DocumentSourceType,
  DocumentStatus,
} from '@insurance-max/contracts';

import { DocumentRenderService } from './document-render.service';
import { DocumentStorageService } from './document-storage.service';
import { DocumentTemplatesService } from './document-templates.service';
import { Document } from './entities/document.entity';
import { DocumentLink } from './entities/document-link.entity';
import { DocumentSecurityScan } from './entities/document-security-scan.entity';
import { DocumentVersion } from './entities/document-version.entity';

@Injectable()
export class DocumentGenerationService {
  constructor(
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    @InjectRepository(DocumentVersion)
    private readonly versionRepository: Repository<DocumentVersion>,
    @InjectRepository(DocumentLink)
    private readonly linkRepository: Repository<DocumentLink>,
    @InjectRepository(DocumentSecurityScan)
    private readonly scanRepository: Repository<DocumentSecurityScan>,
    private readonly templateService: DocumentTemplatesService,
    private readonly renderService: DocumentRenderService,
    private readonly storageService: DocumentStorageService,
  ) {}

  async request(
    user: AuthenticatedUser,
    input: {
      templateCode: string;
      documentType: string;
      title: string;
      sourceSnapshot: Record<string, unknown>;
      resourceType: string;
      resourceId: string;
      customerVisible: boolean;
      intermediaryVisible: boolean;
      publicVerificationEnabled: boolean;
      idempotencyKey: string;
    },
  ) {
    const active = await this.templateService.requireActiveVersion(
      user.companyId!,
      input.templateCode,
    );

    this.renderService.validateVariableSchema(
      active.version.variable_schema,
      input.sourceSnapshot,
    );

    const sourceSnapshotHash = this.renderService.hashDefinition(
      input.sourceSnapshot,
    );

    const existingVersion = await this.versionRepository.findOne({
      where: {
        company_id: user.companyId!,
        template_code: active.template.template_code,
        template_version: active.version.version_number,
        source_snapshot_hash: sourceSnapshotHash,
      },
    });

    if (existingVersion) {
      const existingDocument = await this.documentRepository.findOne({
        where: { id: existingVersion.document_id, company_id: user.companyId! },
        relations: { current_version: true, links: true },
      });

      if (existingDocument) {
        return existingDocument;
      }
    }

    const renderedText = this.renderService.renderTemplate(
      active.version.template_content,
      input.sourceSnapshot,
    );
    const pdf = this.renderService.renderPdf({
      title: input.title,
      body: renderedText,
    });
    const stored = await this.storageService.store({
      buffer: pdf,
      companyId: user.companyId!,
      fileName: `${input.title}.pdf`,
      maximumBytes: this.storageService.maximumBytes(),
      prefix: 'documents/generated',
    });

    const document = await this.documentRepository.save(
      this.documentRepository.create({
        company_id: user.companyId!,
        document_no: `DOC-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        owner_type: input.resourceType,
        owner_id: input.resourceId,
        title: input.title,
        document_type: input.documentType,
        classification: DocumentClassification.CONFIDENTIAL,
        source_type: DocumentSourceType.GENERATED,
        storage_key: stored.storageKey,
        checksum: stored.checksum,
        content_type: stored.detectedMimeType,
        file_name: stored.originalFileName,
        file_size: stored.size,
        status: DocumentStatus.AVAILABLE,
        current_version_id: null,
        customer_visible: input.customerVisible,
        intermediary_visible: input.intermediaryVisible,
        public_verification_enabled: input.publicVerificationEnabled,
        public_verification_code: input.publicVerificationEnabled
          ? `VRF-${crypto.randomUUID().slice(0, 10).toUpperCase()}`
          : null,
        retention_policy_code: null,
        retention_until: null,
        legal_hold: false,
        legal_hold_reason: null,
        uploaded_by: user.id,
        verified_by: user.id,
        verified_at: new Date(),
        rejection_reason: null,
        created_by: user.id,
        archived_at: null,
        deleted_at: null,
      }),
    );

    const version = await this.versionRepository.save(
      this.versionRepository.create({
        company_id: user.companyId!,
        document_id: document.id,
        version_number: 1,
        status: DocumentStatus.AVAILABLE,
        storage_provider: 'local_private',
        storage_bucket: null,
        storage_key: stored.storageKey,
        original_file_name: stored.originalFileName,
        safe_file_name: stored.safeFileName,
        declared_mime_type: stored.detectedMimeType,
        detected_mime_type: stored.detectedMimeType,
        detected_extension: stored.detectedExtension,
        file_size: stored.size,
        sha256_hash: stored.checksum,
        encryption_key_reference: null,
        source_snapshot: input.sourceSnapshot,
        source_snapshot_hash: sourceSnapshotHash,
        template_code: active.template.template_code,
        template_version: active.version.version_number,
        generator_version: 'phase17-internal',
        page_count: 1,
        scan_status: 'CLEAN',
        scan_provider: 'internal',
        scan_reference: null,
        scanned_at: new Date(),
        scan_result: { generated: true },
        uploaded_by: user.id,
        uploaded_at: new Date(),
        supersedes_version_id: null,
      }),
    );

    const scan = await this.scanRepository.save(
      this.scanRepository.create({
        company_id: user.companyId!,
        document_version_id: version.id,
        scan_type: 'GENERATION_REVIEW',
        provider: 'internal',
        status: 'CLEAN',
        result_code: 'GENERATED',
        result_message: 'Generated document accepted into storage.',
        details: {
          idempotencyKey: input.idempotencyKey,
        },
        started_at: new Date(),
        completed_at: new Date(),
      }),
    );

    version.scan_reference = scan.id;
    await this.versionRepository.save(version);

    document.current_version_id = version.id;
    await this.documentRepository.save(document);

    await this.linkRepository.save(
      this.linkRepository.create({
        company_id: user.companyId!,
        document_id: document.id,
        link_type:
          (input.resourceType.toUpperCase() in DocumentLinkType
            ? input.resourceType.toUpperCase()
            : DocumentLinkType.COMMUNICATION) as DocumentLink['link_type'],
        linked_record_type: input.resourceType,
        linked_record_id: input.resourceId,
        customer_visible: input.customerVisible,
        intermediary_visible: input.intermediaryVisible,
        label: input.title,
        created_by: user.id,
      }),
    );

    return this.documentRepository.findOne({
      where: { id: document.id, company_id: user.companyId! },
      relations: { current_version: true, links: true },
    });
  }
}
