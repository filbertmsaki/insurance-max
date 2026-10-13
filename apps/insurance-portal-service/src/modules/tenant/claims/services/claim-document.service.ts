import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { DocumentClassification } from '@insurance-max/contracts';
import {
  paginateQueryBuilder,
  type ListQueryInput,
} from '@insurance-max/portal-shared/utils/paginate-query.util';
import { DataSource, Repository } from 'typeorm';

import { AuditService } from '../../../shared/audit/audit.service';
import { DocumentsService } from '../../insurance-documents/documents.service';
import { Document } from '../../insurance-documents/entities/document.entity';
import { DocumentLink } from '../../insurance-documents/entities/document-link.entity';
import { Policy } from '../../policies/entities/policy.entity';
import {
  AddClaimDocumentDto,
  ClaimDocumentUploadSessionDto,
  LinkClaimDocumentDto,
  VerifyClaimDocumentDto,
} from '../dto/claim-workflow.dto';
import { ClaimDocument } from '../entities/claim-document.entity';
import { ClaimDocumentRequirement } from '../entities/claim-document-requirement.entity';
import { ClaimDocumentStatus } from '../enums/claim.enums';
import { ClaimAccessService } from './claim-access.service';
import { ClaimStateMachineService } from './claim-state-machine.service';

export interface ClaimDocumentRequirementInput {
  id?: string;
  insurance_category_id?: string | null;
  product_id?: string | null;
  claim_stage: string;
  document_type: string;
  title: string;
  description?: string | null;
  is_mandatory?: boolean;
  sort_order?: number;
  is_active?: boolean;
}

export const CLAIM_DOCUMENT_STAGES = [
  'NOTIFICATION',
  'INTIMATION',
  'ASSESSMENT',
  'DISCHARGE',
  'PAYMENT',
  'REJECTION',
] as const;

/**
 * Claim documents on top of the central document registry. Files are
 * uploaded through the registry's upload sessions (size/type validation,
 * versioning, storage); a claim document links a registered file to the
 * claim with its type, stage and verification state. Earlier versions are
 * kept by the registry and are never overwritten.
 */
@Injectable()
export class ClaimDocumentService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(ClaimDocument)
    private readonly documentRepository: Repository<ClaimDocument>,
    @InjectRepository(ClaimDocumentRequirement)
    private readonly requirementRepository: Repository<ClaimDocumentRequirement>,
    private readonly access: ClaimAccessService,
    private readonly documentsService: DocumentsService,
    private readonly stateMachine: ClaimStateMachineService,
    private readonly auditService: AuditService,
  ) {}

  async createUploadSession(
    user: AuthenticatedUser,
    claimId: string,
    dto: ClaimDocumentUploadSessionDto,
  ) {
    const claim = await this.access.getForWrite(user, claimId);

    return this.documentsService.createUploadSession(user, {
      title: dto.title.trim(),
      documentType: dto.document_type.trim(),
      classification: DocumentClassification.INTERNAL,
      resourceType: 'CLAIM',
      resourceId: claim.id,
      linkType: 'CLAIM',
      linkLabel: dto.title.trim(),
    });
  }

  /** Attaches an uploaded registry document to the claim. */
  async link(
    user: AuthenticatedUser,
    claimId: string,
    dto: LinkClaimDocumentDto,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const claim = await this.access.getForWrite(user, claimId, manager);
      const document = await manager.getRepository(Document).findOne({
        where: { id: dto.document_id, company_id: claim.company_id },
      });

      if (!document) {
        throw new NotFoundException('Document not found');
      }

      const linkedToClaim =
        (document.owner_type === 'CLAIM' && document.owner_id === claim.id) ||
        (await manager.getRepository(DocumentLink).count({
          where: {
            document_id: document.id,
            linked_record_type: 'CLAIM',
            linked_record_id: claim.id,
          },
        })) > 0;

      if (!linkedToClaim) {
        throw new BadRequestException(
          'The document was not uploaded for this claim',
        );
      }

      const existing = await manager.getRepository(ClaimDocument).findOne({
        where: { claim_id: claim.id, document_id: document.id },
      });

      if (existing) {
        // A new version of an already linked file: refresh the pointer.
        existing.storage_key = document.storage_key;
        existing.file_name = document.file_name;
        existing.mime_type = document.content_type;
        existing.file_size =
          document.file_size != null ? String(document.file_size) : null;
        existing.checksum = document.checksum;
        existing.status = ClaimDocumentStatus.UPLOADED;
        existing.verified_by = null;
        existing.verified_at = null;
        existing.metadata = {
          ...(existing.metadata ?? {}),
          version_id: document.current_version_id,
        };

        return manager.getRepository(ClaimDocument).save(existing);
      }

      const saved = await manager.getRepository(ClaimDocument).save({
        company_id: claim.company_id,
        claim_id: claim.id,
        document_id: document.id,
        document_type: dto.document_type.trim(),
        requirement_code: dto.requirement_code?.trim() ?? null,
        title: dto.title.trim(),
        storage_key: document.storage_key,
        file_name: document.file_name,
        mime_type: document.content_type,
        file_size:
          document.file_size != null ? String(document.file_size) : null,
        checksum: document.checksum,
        status: ClaimDocumentStatus.UPLOADED,
        uploaded_by: user.id,
        uploaded_at: new Date(),
        verified_by: null,
        verified_at: null,
        rejection_reason: null,
        expires_at: null,
        metadata: {
          claim_stage: dto.claim_stage ?? null,
          subject_id: dto.subject_id ?? null,
          version_id: document.current_version_id,
        },
      });

      await this.stateMachine.recordEvent(manager, claim, {
        eventType: 'DOCUMENT_UPLOADED',
        summary: `${saved.title} uploaded (${saved.file_name})`,
        actorId: user.id,
        subjectType: 'DOCUMENT',
        subjectId: saved.id,
      });

      return saved;
    });
  }

  /** Metadata-only registration kept for existing integrations. */
  async register(
    user: AuthenticatedUser,
    claimId: string,
    dto: AddClaimDocumentDto,
  ) {
    const claim = await this.access.getForWrite(user, claimId);
    const registered = await this.documentsService.register(user, {
      ownerType: 'CLAIM',
      ownerId: claim.id,
      fileName: dto.file_name.trim(),
      checksum: dto.checksum?.trim() ?? 'UNVERIFIED',
      contentType: dto.mime_type?.trim() ?? null,
      fileSize: dto.file_size ?? null,
    });

    return this.link(user, claim.id, {
      document_id: registered.id,
      document_type: dto.document_type,
      title: dto.title,
      requirement_code: dto.requirement_code,
    });
  }

  async verify(
    user: AuthenticatedUser,
    documentId: string,
    dto: VerifyClaimDocumentDto,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const { record, claim } = await this.access.getRecordForWrite(
        manager,
        user,
        ClaimDocument,
        documentId,
        'Claim document',
      );

      if (dto.decision === 'REJECTED' && !dto.rejection_reason?.trim()) {
        throw new BadRequestException('A rejection reason is required');
      }

      if (record.uploaded_by === user.id && dto.decision === 'VERIFIED') {
        throw new ConflictException(
          'A document cannot be verified by the person who uploaded it',
        );
      }

      record.status =
        dto.decision === 'VERIFIED'
          ? ClaimDocumentStatus.VERIFIED
          : ClaimDocumentStatus.REJECTED;
      record.verified_by = user.id;
      record.verified_at = new Date();
      record.rejection_reason = dto.rejection_reason?.trim() ?? null;
      const saved = await manager.getRepository(ClaimDocument).save(record);

      await this.stateMachine.recordEvent(manager, claim, {
        eventType:
          dto.decision === 'VERIFIED'
            ? 'DOCUMENT_VERIFIED'
            : 'DOCUMENT_REJECTED',
        summary: `${record.title} ${dto.decision === 'VERIFIED' ? 'verified' : `rejected: ${record.rejection_reason}`}`,
        actorId: user.id,
        subjectType: 'DOCUMENT',
        subjectId: record.id,
      });

      return saved;
    });
  }

  /** Documents plus the checklist of what the claim's product requires. */
  async listForClaim(user: AuthenticatedUser, claimId: string) {
    const claim = await this.access.getForRead(user, claimId);
    const policy = await this.dataSource.getRepository(Policy).findOne({
      where: { id: claim.policy_id },
      select: ['id', 'product_id', 'category_id'],
    });
    const [documents, requirements] = await Promise.all([
      this.documentRepository.find({
        where: { claim_id: claim.id },
        order: { uploaded_at: 'DESC' },
      }),
      this.requirementsFor(
        claim.company_id,
        policy?.product_id ?? null,
        policy?.category_id ?? null,
      ),
    ]);

    return {
      documents,
      requirements: requirements.map((requirement) => {
        const matches = documents.filter(
          (document) => document.document_type === requirement.document_type,
        );

        return {
          ...requirement,
          satisfied: matches.some((document) =>
            [
              ClaimDocumentStatus.UPLOADED,
              ClaimDocumentStatus.VERIFIED,
            ].includes(document.status),
          ),
          verified: matches.some(
            (document) => document.status === ClaimDocumentStatus.VERIFIED,
          ),
        };
      }),
    };
  }

  /** Company-wide register used by the Claim Documents menu. */
  async listForCompany(
    user: AuthenticatedUser,
    query: { status?: string } & ListQueryInput,
  ) {
    const queryBuilder = this.documentRepository
      .createQueryBuilder('document')
      .innerJoinAndSelect('document.claim', 'claim')
      .where('claim.deleted_at IS NULL');

    this.access.applyReadScope(queryBuilder, 'claim', user);

    if (query.status) {
      queryBuilder.andWhere('document.status = :status', {
        status: query.status,
      });
    }

    const result = await paginateQueryBuilder(queryBuilder, query, {
      sortable: {
        uploaded_at: 'document.uploaded_at',
        title: 'document.title',
        type: 'document.document_type',
        status: 'document.status',
        claim: 'claim.claim_no',
      },
      defaultSort: 'uploaded_at',
      searchable: [
        'document.title',
        'document.file_name',
        'document.document_type',
        'claim.claim_no',
      ],
      tieBreaker: 'document.id',
    });

    return {
      ...result,
      data: result.data.map((item) => ({
        ...item,
        claim: {
          id: item.claim.id,
          claim_no: item.claim.claim_no,
          status: item.claim.status,
        },
      })),
    };
  }

  // ---------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------

  listRequirements(companyId: string) {
    return this.requirementRepository.find({
      where: { company_id: companyId },
      order: { claim_stage: 'ASC', sort_order: 'ASC', title: 'ASC' },
    });
  }

  async saveRequirement(
    user: AuthenticatedUser,
    input: ClaimDocumentRequirementInput,
  ) {
    if (
      !(CLAIM_DOCUMENT_STAGES as readonly string[]).includes(input.claim_stage)
    ) {
      throw new BadRequestException(
        `Stage must be one of ${CLAIM_DOCUMENT_STAGES.join(', ')}`,
      );
    }

    const companyId = user.companyId!;
    let requirement: ClaimDocumentRequirement;

    if (input.id) {
      const existing = await this.requirementRepository.findOne({
        where: { id: input.id, company_id: companyId },
      });

      if (!existing) {
        throw new NotFoundException('Document requirement not found');
      }

      requirement = Object.assign(existing, input, { company_id: companyId });
    } else {
      requirement = this.requirementRepository.create({
        ...input,
        company_id: companyId,
        created_by: user.id,
      });
    }

    const saved = await this.requirementRepository.save(requirement);

    await this.auditService.log({
      userId: user.id,
      companyId,
      action: input.id
        ? 'claim.document_requirement.updated'
        : 'claim.document_requirement.created',
      resource: 'claim_document_requirement',
      resourceId: saved.id,
      afterState: { ...saved },
    });

    return saved;
  }

  async deactivateRequirement(user: AuthenticatedUser, id: string) {
    const requirement = await this.requirementRepository.findOne({
      where: { id, company_id: user.companyId! },
    });

    if (!requirement) {
      throw new NotFoundException('Document requirement not found');
    }

    requirement.is_active = false;

    return this.requirementRepository.save(requirement);
  }

  private requirementsFor(
    companyId: string,
    productId: string | null,
    categoryId: string | null,
  ) {
    return this.requirementRepository
      .createQueryBuilder('requirement')
      .where('requirement.company_id = :companyId', { companyId })
      .andWhere('requirement.is_active = true')
      .andWhere(
        '(requirement.product_id IS NULL OR requirement.product_id = :productId)',
        {
          productId,
        },
      )
      .andWhere(
        '(requirement.insurance_category_id IS NULL OR requirement.insurance_category_id = :categoryId)',
        { categoryId },
      )
      .orderBy('requirement.claim_stage', 'ASC')
      .addOrderBy('requirement.sort_order', 'ASC')
      .getMany();
  }
}
