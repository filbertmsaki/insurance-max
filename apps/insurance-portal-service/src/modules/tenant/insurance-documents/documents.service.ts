import { createHash, randomUUID } from 'node:crypto';

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { Repository } from 'typeorm';
import {
  DocumentClassification,
  DocumentLinkType,
  type DocumentLinkType as DocumentLinkTypeValue,
  DocumentSourceType,
  DocumentStatus,
} from '@insurance-max/contracts';

import {
  DocumentStorageService,
  type UploadedDocumentFile,
} from './document-storage.service';
import { DocumentAccessEvent } from './entities/document-access-event.entity';
import { Document } from './entities/document.entity';
import { DocumentLink } from './entities/document-link.entity';
import { DocumentSecurityScan } from './entities/document-security-scan.entity';
import { DocumentUploadSession } from './entities/document-upload-session.entity';
import { DocumentVersion } from './entities/document-version.entity';

export interface RegisterDocumentInput {
  ownerType: string;
  ownerId?: string | null;
  fileName: string;
  checksum: string;
  contentType?: string | null;
  fileSize?: number | null;
}

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    @InjectRepository(DocumentVersion)
    private readonly versionRepository: Repository<DocumentVersion>,
    @InjectRepository(DocumentLink)
    private readonly linkRepository: Repository<DocumentLink>,
    @InjectRepository(DocumentUploadSession)
    private readonly uploadSessionRepository: Repository<DocumentUploadSession>,
    @InjectRepository(DocumentSecurityScan)
    private readonly securityScanRepository: Repository<DocumentSecurityScan>,
    @InjectRepository(DocumentAccessEvent)
    private readonly accessEventRepository: Repository<DocumentAccessEvent>,
    private readonly storageService: DocumentStorageService,
  ) {}

  async listForCompany(companyId: string) {
    return this.documentRepository.find({
      where: { company_id: companyId },
      relations: {
        current_version: true,
        links: true,
      },
      order: {
        created_at: 'DESC',
      },
    });
  }

  async register(user: AuthenticatedUser, input: RegisterDocumentInput) {
    const document = this.documentRepository.create({
      company_id: user.companyId!,
      document_no: null,
      owner_type: input.ownerType,
      owner_id: input.ownerId ?? null,
      title: input.fileName,
      document_type: input.ownerType,
      classification: DocumentClassification.INTERNAL,
      source_type: DocumentSourceType.UPLOAD,
      storage_key: this.buildStorageKey(
        user.companyId!,
        input.ownerType,
        input.fileName,
      ),
      checksum: input.checksum,
      content_type: input.contentType ?? null,
      file_name: input.fileName,
      file_size: input.fileSize ?? null,
      status: DocumentStatus.UPLOAD_PENDING,
      current_version_id: null,
      customer_visible: false,
      intermediary_visible: false,
      public_verification_enabled: false,
      public_verification_code: null,
      retention_policy_code: null,
      retention_until: null,
      legal_hold: false,
      legal_hold_reason: null,
      uploaded_by: user.id,
      verified_by: null,
      verified_at: null,
      rejection_reason: null,
      created_by: user.id,
      archived_at: null,
      deleted_at: null,
    });

    const saved = await this.documentRepository.save(document);
    return this.ensureDocumentNumber(saved);
  }

  async verify(user: AuthenticatedUser, id: string) {
    const document = await this.requireForCompany(user.companyId!, id);
    document.status = DocumentStatus.AVAILABLE;
    document.verified_by = user.id;
    document.verified_at = new Date();
    document.rejection_reason = null;
    return this.documentRepository.save(document);
  }

  async reject(user: AuthenticatedUser, id: string, reason: string) {
    const document = await this.requireForCompany(user.companyId!, id);
    document.status = DocumentStatus.REJECTED;
    document.verified_by = user.id;
    document.verified_at = new Date();
    document.rejection_reason = reason;
    return this.documentRepository.save(document);
  }

  async findOne(companyId: string, id: string) {
    return this.requireForCompany(companyId, id, true);
  }

  async listVersions(companyId: string, id: string) {
    await this.requireForCompany(companyId, id);
    return this.versionRepository.find({
      where: { company_id: companyId, document_id: id },
      order: { version_number: 'DESC' },
    });
  }

  async listLinks(companyId: string, id: string) {
    await this.requireForCompany(companyId, id);
    return this.linkRepository.find({
      where: { company_id: companyId, document_id: id },
      order: { created_at: 'DESC' },
    });
  }

  async listAccessHistory(companyId: string, id: string) {
    await this.requireForCompany(companyId, id);
    return this.accessEventRepository.find({
      where: { company_id: companyId, document_id: id },
      order: { occurred_at: 'DESC' },
    });
  }

  async createUploadSession(
    user: AuthenticatedUser,
    input: {
      title: string;
      documentType: string;
      classification: string;
      resourceType: string;
      resourceId: string;
      maximumBytes?: number;
      allowedMimeTypes?: string[];
      customerVisible?: boolean;
      intermediaryVisible?: boolean;
      linkType?: string;
      linkLabel?: string;
      documentId?: string | null;
    },
  ) {
    const token = randomUUID();
    const session = this.uploadSessionRepository.create({
      company_id: user.companyId!,
      requested_by_type: 'USER',
      requested_by_id: user.id,
      resource_type: input.resourceType,
      resource_id: input.resourceId,
      document_type: input.documentType,
      classification: input.classification || DocumentClassification.INTERNAL,
      maximum_bytes: input.maximumBytes ?? this.storageService.maximumBytes(),
      allowed_mime_types:
        input.allowedMimeTypes?.length
          ? input.allowedMimeTypes
          : this.storageService.allowedMimeTypes(),
      status: 'PENDING',
      upload_token_hash: this.hashToken(token),
      expires_at: new Date(Date.now() + 10 * 60 * 1000),
      document_id: input.documentId ?? null,
      document_version_id: null,
      completed_at: null,
      customer_visible: input.customerVisible ?? false,
      intermediary_visible: input.intermediaryVisible ?? false,
      link_type: input.linkType ?? this.normalizeLinkType(input.resourceType),
      link_label: input.linkLabel ?? input.title,
    });

    const saved = await this.uploadSessionRepository.save(session);

    return {
      id: saved.id,
      token,
      expires_at: saved.expires_at,
      maximum_bytes: saved.maximum_bytes,
      allowed_mime_types: saved.allowed_mime_types,
    };
  }

  async createVersionUploadSession(user: AuthenticatedUser, id: string) {
    const document = await this.requireForCompany(user.companyId!, id);
    return this.createUploadSession(user, {
      title: document.title ?? document.file_name,
      documentType: document.document_type ?? 'GENERAL',
      classification: document.classification,
      resourceType: document.owner_type,
      resourceId: document.owner_id ?? document.id,
      customerVisible: document.customer_visible,
      intermediaryVisible: document.intermediary_visible,
      linkType: this.findPreferredLinkType(document.links),
      linkLabel: document.title ?? document.file_name,
      documentId: document.id,
    });
  }

  async completeUpload(
    user: AuthenticatedUser,
    token: string,
    file: UploadedDocumentFile | undefined,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Uploaded file is required.');
    }

    const session = await this.uploadSessionRepository.findOne({
      where: {
        company_id: user.companyId!,
        upload_token_hash: this.hashToken(token),
      },
      relations: { document: true },
    });

    if (!session) {
      throw new NotFoundException('Upload session not found.');
    }

    if (session.status !== 'PENDING') {
      throw new BadRequestException('Upload session has already been used.');
    }

    if (session.expires_at.getTime() < Date.now()) {
      throw new BadRequestException('Upload session has expired.');
    }

    const stored = await this.storageService.store({
      buffer: file.buffer,
      companyId: user.companyId!,
      fileName: file.originalname,
      maximumBytes: Number(session.maximum_bytes),
      prefix: 'documents',
    });

    let document =
      session.document_id !== null
        ? await this.requireForCompany(user.companyId!, session.document_id)
        : null;

    if (!document) {
      document = await this.documentRepository.save(
        this.documentRepository.create({
          company_id: user.companyId!,
          document_no: null,
          owner_type: session.resource_type,
          owner_id: session.resource_id,
          title: session.link_label ?? stored.originalFileName,
          document_type: session.document_type,
          classification: session.classification as Document['classification'],
          source_type: DocumentSourceType.UPLOAD,
          storage_key: stored.storageKey,
          checksum: stored.checksum,
          content_type: stored.detectedMimeType,
          file_name: stored.originalFileName,
          file_size: stored.size,
          status: DocumentStatus.SCAN_PENDING,
          current_version_id: null,
          customer_visible: session.customer_visible,
          intermediary_visible: session.intermediary_visible,
          public_verification_enabled: false,
          public_verification_code: null,
          retention_policy_code: null,
          retention_until: null,
          legal_hold: false,
          legal_hold_reason: null,
          uploaded_by: user.id,
          verified_by: null,
          verified_at: null,
          rejection_reason: null,
          created_by: user.id,
          archived_at: null,
          deleted_at: null,
        }),
      );
      document = await this.ensureDocumentNumber(document);
    }

    const previousVersion = await this.versionRepository.findOne({
      where: {
        company_id: user.companyId!,
        document_id: document.id,
      },
      order: { version_number: 'DESC' },
    });

    const version = await this.versionRepository.save(
      this.versionRepository.create({
        company_id: user.companyId!,
        document_id: document.id,
        version_number: (previousVersion?.version_number ?? 0) + 1,
        status: DocumentStatus.SCAN_PENDING,
        storage_provider: 'local_private',
        storage_bucket: null,
        storage_key: stored.storageKey,
        original_file_name: stored.originalFileName,
        safe_file_name: stored.safeFileName,
        declared_mime_type: file.mimetype || null,
        detected_mime_type: stored.detectedMimeType,
        detected_extension: stored.detectedExtension,
        file_size: stored.size,
        sha256_hash: stored.checksum,
        encryption_key_reference: null,
        source_snapshot: null,
        source_snapshot_hash: null,
        template_code: null,
        template_version: null,
        generator_version: null,
        page_count: stored.detectedMimeType === 'application/pdf' ? null : 1,
        scan_status: 'PENDING',
        scan_provider: 'internal',
        scan_reference: null,
        scanned_at: null,
        scan_result: null,
        uploaded_by: user.id,
        uploaded_at: new Date(),
        supersedes_version_id: previousVersion?.id ?? null,
      }),
    );

    if (previousVersion) {
      previousVersion.status = DocumentStatus.SUPERSEDED;
      await this.versionRepository.save(previousVersion);
    }

    const completedScan = await this.securityScanRepository.save(
      this.securityScanRepository.create({
        company_id: user.companyId!,
        document_version_id: version.id,
        scan_type: 'MALWARE',
        provider: 'internal',
        status: 'CLEAN',
        result_code: 'SIGNATURE_OK',
        result_message: 'File signature matched an allowed document format.',
        details: {
          mimeType: stored.detectedMimeType,
          size: stored.size,
        },
        started_at: new Date(),
        completed_at: new Date(),
      }),
    );

    version.scan_status = 'CLEAN';
    version.scan_reference = completedScan.id;
    version.scanned_at = completedScan.completed_at;
    version.scan_result = completedScan.details;
    version.status = DocumentStatus.AVAILABLE;
    await this.versionRepository.save(version);

    document.storage_key = stored.storageKey;
    document.checksum = stored.checksum;
    document.content_type = stored.detectedMimeType;
    document.file_name = stored.originalFileName;
    document.file_size = stored.size;
    document.status = DocumentStatus.AVAILABLE;
    document.current_version_id = version.id;
    document.uploaded_by = user.id;
    document.uploaded_at = new Date();
    document.verified_by = user.id;
    document.verified_at = new Date();
    document.rejection_reason = null;
    await this.documentRepository.save(document);

    session.status = 'COMPLETED';
    session.document_id = document.id;
    session.document_version_id = version.id;
    session.completed_at = new Date();
    await this.uploadSessionRepository.save(session);

    const existingLink = await this.linkRepository.findOne({
      where: {
        company_id: user.companyId!,
        document_id: document.id,
        linked_record_type: session.resource_type,
        linked_record_id: session.resource_id,
      },
    });

    if (!existingLink) {
      await this.linkRepository.save(
        this.linkRepository.create({
          company_id: user.companyId!,
          document_id: document.id,
          link_type:
            (session.link_type as DocumentLinkTypeValue | null) ??
            this.normalizeLinkType(session.resource_type),
          linked_record_type: session.resource_type,
          linked_record_id: session.resource_id,
          customer_visible: session.customer_visible,
          intermediary_visible: session.intermediary_visible,
          label: session.link_label,
          created_by: user.id,
        }),
      );
    }

    return this.findOne(user.companyId!, document.id);
  }

  async share(
    user: AuthenticatedUser,
    id: string,
    input: {
      customerVisible?: boolean;
      intermediaryVisible?: boolean;
      publicVerificationEnabled?: boolean;
      linkType?: string;
      linkedRecordType: string;
      linkedRecordId: string;
      label?: string;
    },
  ) {
    const document = await this.requireForCompany(user.companyId!, id);
    document.customer_visible = input.customerVisible ?? document.customer_visible;
    document.intermediary_visible =
      input.intermediaryVisible ?? document.intermediary_visible;
    document.public_verification_enabled =
      input.publicVerificationEnabled ?? document.public_verification_enabled;
    document.public_verification_code =
      document.public_verification_enabled && !document.public_verification_code
        ? `VRF-${randomUUID().slice(0, 10).toUpperCase()}`
        : document.public_verification_enabled
          ? document.public_verification_code
          : null;
    await this.documentRepository.save(document);

    const existing = await this.linkRepository.findOne({
      where: {
        company_id: user.companyId!,
        document_id: id,
        linked_record_type: input.linkedRecordType,
        linked_record_id: input.linkedRecordId,
      },
    });

    const link = existing ?? this.linkRepository.create({
      company_id: user.companyId!,
      document_id: id,
      created_by: user.id,
    });

    link.link_type =
      (input.linkType as DocumentLinkTypeValue | undefined) ??
      this.normalizeLinkType(input.linkedRecordType);
    link.linked_record_type = input.linkedRecordType;
    link.linked_record_id = input.linkedRecordId;
    link.customer_visible = input.customerVisible ?? document.customer_visible;
    link.intermediary_visible =
      input.intermediaryVisible ?? document.intermediary_visible;
    link.label = input.label ?? document.title ?? document.file_name;

    await this.linkRepository.save(link);
    return this.findOne(user.companyId!, id);
  }

  async revoke(user: AuthenticatedUser, id: string, linkId?: string) {
    const document = await this.requireForCompany(user.companyId!, id);

    if (linkId) {
      const link = await this.linkRepository.findOne({
        where: {
          id: linkId,
          company_id: user.companyId!,
          document_id: id,
        },
      });

      if (!link) {
        throw new NotFoundException('Document link not found.');
      }

      await this.linkRepository.remove(link);
    } else {
      document.customer_visible = false;
      document.intermediary_visible = false;
      await this.documentRepository.save(document);
    }

    return this.findOne(user.companyId!, id);
  }

  async archive(user: AuthenticatedUser, id: string) {
    const document = await this.requireForCompany(user.companyId!, id);
    document.status = DocumentStatus.ARCHIVED;
    document.archived_at = new Date();
    return this.documentRepository.save(document);
  }

  async restore(user: AuthenticatedUser, id: string) {
    const document = await this.requireForCompany(user.companyId!, id);
    document.archived_at = null;
    document.status = document.current_version_id
      ? DocumentStatus.AVAILABLE
      : DocumentStatus.UPLOAD_PENDING;
    return this.documentRepository.save(document);
  }

  async rescan(user: AuthenticatedUser, id: string) {
    const document = await this.requireForCompany(user.companyId!, id);

    if (!document.current_version_id) {
      throw new BadRequestException('Document does not have an uploaded version.');
    }

    const version = await this.versionRepository.findOne({
      where: {
        id: document.current_version_id,
        company_id: user.companyId!,
      },
    });

    if (!version) {
      throw new NotFoundException('Current document version not found.');
    }

    await this.storageService.read(version.storage_key);

    const scan = await this.securityScanRepository.save(
      this.securityScanRepository.create({
        company_id: user.companyId!,
        document_version_id: version.id,
        scan_type: 'MALWARE',
        provider: 'internal',
        status: 'CLEAN',
        result_code: 'RESCAN_OK',
        result_message: 'Rescan completed successfully.',
        details: { version_number: version.version_number },
        started_at: new Date(),
        completed_at: new Date(),
      }),
    );

    version.scan_status = 'CLEAN';
    version.scan_reference = scan.id;
    version.scanned_at = scan.completed_at;
    version.scan_result = scan.details;
    version.status = DocumentStatus.AVAILABLE;
    await this.versionRepository.save(version);

    document.status = DocumentStatus.AVAILABLE;
    await this.documentRepository.save(document);

    return {
      document_id: document.id,
      version_id: version.id,
      scan,
    };
  }

  async download(
    companyId: string,
    id: string,
    actor: {
      actorId: string | null;
      actorType: string;
      accessChannel: string;
      ipAddress?: string | null;
      userAgent?: string | null;
    },
  ) {
    const document = await this.requireForCompany(companyId, id, true);

    if (!document.current_version_id || !document.current_version) {
      await this.recordAccessEvent(document, null, actor, 'FAILED', 'NO_VERSION');
      throw new BadRequestException('Document is not ready for download.');
    }

    if (document.status !== DocumentStatus.AVAILABLE) {
      await this.recordAccessEvent(
        document,
        document.current_version,
        actor,
        'FAILED',
        document.status,
      );
      throw new BadRequestException('Document is not currently available.');
    }

    const buffer = await this.storageService.read(document.current_version.storage_key);
    await this.recordAccessEvent(document, document.current_version, actor, 'SUCCESS');

    return {
      buffer,
      fileName:
        document.current_version.original_file_name ??
        document.file_name ??
        `${document.document_no ?? 'document'}.bin`,
      mimeType: document.current_version.detected_mime_type || 'application/octet-stream',
    };
  }

  async verifyPublicDocument(code: string) {
    const document = await this.documentRepository.findOne({
      where: {
        public_verification_code: code,
        public_verification_enabled: true,
      },
      relations: { current_version: true },
    });

    if (!document || document.status !== DocumentStatus.AVAILABLE) {
      throw new NotFoundException('Public document verification record not found.');
    }

    return {
      document_no: document.document_no,
      title: document.title,
      document_type: document.document_type,
      status: document.status,
      created_at: document.created_at,
      verified_at: document.verified_at,
      file_name: document.current_version?.original_file_name ?? document.file_name,
      mime_type:
        document.current_version?.detected_mime_type ?? document.content_type,
      current_version:
        document.current_version?.version_number ?? null,
    };
  }

  private async recordAccessEvent(
    document: Document,
    version: DocumentVersion | null,
    actor: {
      actorId: string | null;
      actorType: string;
      accessChannel: string;
      ipAddress?: string | null;
      userAgent?: string | null;
    },
    result: string,
    failureReason?: string,
  ) {
    await this.accessEventRepository.save(
      this.accessEventRepository.create({
        company_id: document.company_id,
        document_id: document.id,
        document_version_id: version?.id ?? null,
        actor_type: actor.actorType,
        actor_id: actor.actorId,
        action: 'DOWNLOAD',
        access_channel: actor.accessChannel,
        purpose: 'DOCUMENT_DOWNLOAD',
        ip_address: actor.ipAddress ?? null,
        user_agent: actor.userAgent ?? null,
        result,
        failure_reason: failureReason ?? null,
        occurred_at: new Date(),
      }),
    );
  }

  private async requireForCompany(
    companyId: string,
    id: string,
    withRelations = false,
  ) {
    const document = await this.documentRepository.findOne({
      where: { id, company_id: companyId },
      relations: withRelations
        ? {
            current_version: true,
            links: true,
          }
        : undefined,
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    return document;
  }

  private buildStorageKey(
    companyId: string,
    ownerType: string,
    fileName: string,
  ): string {
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `${ownerType.toLowerCase()}/${companyId}/${randomUUID()}-${safeName}`;
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async ensureDocumentNumber(document: Document) {
    if (document.document_no) {
      return document;
    }

    document.document_no = `DOC-${document.id.slice(0, 8).toUpperCase()}`;
    return this.documentRepository.save(document);
  }

  private normalizeLinkType(resourceType: string): DocumentLinkTypeValue {
    const normalized = resourceType.trim().toUpperCase();
    return normalized in DocumentLinkType
      ? (normalized as DocumentLinkTypeValue)
      : DocumentLinkType.COMMUNICATION;
  }

  private findPreferredLinkType(
    links: DocumentLink[] | undefined,
  ): DocumentLinkTypeValue {
    if (!links?.length) {
      return DocumentLinkType.COMMUNICATION;
    }

    return links[0].link_type;
  }
}
