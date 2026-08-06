import { randomUUID } from 'node:crypto';

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

import { Document, DocumentStatus } from './entities/document.entity';

export interface RegisterDocumentInput {
  ownerType: string;
  ownerId?: string | null;
  fileName: string;
  checksum: string;
  contentType?: string | null;
  fileSize?: number | null;
}

/**
 * Lightweight document registry (§14.9/14.19 "controlled document
 * service"). The storage key is always generated here, server-side —
 * callers never get to supply an arbitrary path.
 */
@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(Document)
    private readonly repository: Repository<Document>,
  ) {}

  async register(user: AuthenticatedUser, input: RegisterDocumentInput) {
    const storageKey = this.buildStorageKey(
      user.companyId!,
      input.ownerType,
      input.fileName,
    );

    return this.repository.save(
      this.repository.create({
        company_id: user.companyId!,
        owner_type: input.ownerType,
        owner_id: input.ownerId ?? null,
        storage_key: storageKey,
        checksum: input.checksum,
        content_type: input.contentType ?? null,
        file_name: input.fileName,
        file_size: input.fileSize ?? null,
        status: DocumentStatus.PENDING,
        uploaded_by: user.id,
      }),
    );
  }

  async verify(user: AuthenticatedUser, id: string) {
    const document = await this.requireForCompany(user.companyId!, id);
    document.status = DocumentStatus.VERIFIED;
    document.verified_by = user.id;
    document.verified_at = new Date();
    document.rejection_reason = null;

    return this.repository.save(document);
  }

  async reject(user: AuthenticatedUser, id: string, reason: string) {
    const document = await this.requireForCompany(user.companyId!, id);
    document.status = DocumentStatus.REJECTED;
    document.verified_by = user.id;
    document.verified_at = new Date();
    document.rejection_reason = reason;

    return this.repository.save(document);
  }

  async findOne(companyId: string, id: string) {
    return this.requireForCompany(companyId, id);
  }

  private async requireForCompany(companyId: string, id: string) {
    const document = await this.repository.findOne({
      where: { id, company_id: companyId },
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
}
