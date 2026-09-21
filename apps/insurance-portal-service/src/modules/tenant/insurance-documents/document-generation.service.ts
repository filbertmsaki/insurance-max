import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
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

    const documentNo = `DOC-${randomUUID().slice(0, 8).toUpperCase()}`;
    const publicVerificationCode = input.publicVerificationEnabled
      ? `VRF-${randomUUID().slice(0, 10).toUpperCase()}`
      : null;
    const generatedAt = new Date();
    const renderSnapshot = {
      ...input.sourceSnapshot,
      document: {
        document_no: documentNo,
        title: input.title,
        template_code: active.template.template_code,
        template_version: active.version.version_number,
        generated_at: generatedAt.toISOString(),
        public_verification_code: publicVerificationCode,
      },
    };

    this.renderService.validateVariableSchema(
      active.version.variable_schema,
      renderSnapshot,
    );

    const renderedText = this.renderService.renderTemplate(
      active.version.template_content,
      renderSnapshot,
    );
    const renderedHeader = active.version.header_content
      ? this.renderService.renderTemplate(
          active.version.header_content,
          renderSnapshot,
        )
      : null;
    const renderedFooter = active.version.footer_content
      ? this.renderService.renderTemplate(
          active.version.footer_content,
          renderSnapshot,
        )
      : publicVerificationCode
        ? `Verification code: ${publicVerificationCode} | Page {{page_number}} of {{page_count}}`
        : null;
    const pdf = await this.renderService.renderPdf({
      title: input.title,
      body: renderedText,
      header: renderedHeader,
      footer: renderedFooter,
      stylesheet: active.version.stylesheet_content,
    });
    const stored = await this.storageService.store({
      buffer: pdf.buffer,
      companyId: user.companyId!,
      fileName: `${input.title}.pdf`,
      maximumBytes: this.storageService.maximumBytes(),
      prefix: 'documents/generated',
    });

    const document = await this.documentRepository.save(
      this.documentRepository.create({
        company_id: user.companyId!,
        document_no: documentNo,
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
        public_verification_code: publicVerificationCode,
        retention_policy_code: null,
        retention_until: null,
        legal_hold: false,
        legal_hold_reason: null,
        uploaded_by: user.id,
        verified_by: user.id,
        verified_at: generatedAt,
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
        storage_provider: this.storageService.storageProvider(),
        storage_bucket: this.storageService.storageBucket(),
        storage_key: stored.storageKey,
        original_file_name: stored.originalFileName,
        safe_file_name: stored.safeFileName,
        declared_mime_type: stored.detectedMimeType,
        detected_mime_type: stored.detectedMimeType,
        detected_extension: stored.detectedExtension,
        file_size: stored.size,
        sha256_hash: stored.checksum,
        encryption_key_reference: null,
        source_snapshot: renderSnapshot,
        source_snapshot_hash: sourceSnapshotHash,
        template_code: active.template.template_code,
        template_version: active.version.version_number,
        generator_version: pdf.layoutReview.engine,
        page_count: pdf.pageCount,
        scan_status:
          pdf.layoutReview.status === 'PASSED' ? 'CLEAN' : 'CLEAN_WITH_NOTES',
        scan_provider: 'internal',
        scan_reference: null,
        scanned_at: generatedAt,
        scan_result: {
          generated: true,
          render: {
            status: pdf.layoutReview.status,
            warnings: pdf.layoutReview.warnings,
            page_count: pdf.pageCount,
            template_hash: active.version.template_hash,
            idempotency_key: input.idempotencyKey,
          },
        },
        uploaded_by: user.id,
        uploaded_at: generatedAt,
        supersedes_version_id: null,
      }),
    );

    const scan = await this.scanRepository.save(
      this.scanRepository.create({
        company_id: user.companyId!,
        document_version_id: version.id,
        scan_type: 'GENERATION_REVIEW',
        provider: 'internal',
        status:
          pdf.layoutReview.status === 'PASSED' ? 'CLEAN' : 'CLEAN_WITH_NOTES',
        result_code: 'GENERATED',
        result_message:
          pdf.layoutReview.status === 'PASSED'
            ? 'Generated PDF passed internal layout review.'
            : 'Generated PDF stored with internal layout review warnings.',
        details: {
          idempotencyKey: input.idempotencyKey,
          layoutReview: pdf.layoutReview,
          pageCount: pdf.pageCount,
        },
        started_at: generatedAt,
        completed_at: generatedAt,
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
        link_type: (input.resourceType.toUpperCase() in DocumentLinkType
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
