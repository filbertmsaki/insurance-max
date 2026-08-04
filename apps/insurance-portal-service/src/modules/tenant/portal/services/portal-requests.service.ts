import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Brackets,
  DataSource,
  EntityManager,
  QueryFailedError,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';

import { AuditService } from '../../../shared/audit/audit.service';
import { CompanyUser } from '../../../platform/companies/entities/company-user.entity';
import { Invoice } from '../../billing-commission/entities/invoice.entity';

import {
  AssignPortalRequestDto,
  CompletePortalRequestDto,
  CreateClaimNotificationDto,
  CreatePaymentProofDto,
  CreatePolicyPortalRequestDto,
  CreateQuotationAssistanceDto,
  PortalRequestFilterDto,
  ReviewPaymentProofDto,
  TransitionPortalRequestDto,
} from '../dto/portal-request.dto';
import { PortalAccount } from '../entities/portal-account.entity';
import { PortalPaymentProof } from '../entities/portal-payment-proof.entity';
import { PortalRequestAttachment } from '../entities/portal-request-attachment.entity';
import { PortalServiceRequest } from '../entities/portal-service-request.entity';
import { PortalServiceRequestEvent } from '../entities/portal-service-request-event.entity';
import {
  PortalAttachmentStatus,
  PortalNotificationSeverity,
  PortalPaymentProofStatus,
  PortalRequestStatus,
  PortalRequestType,
} from '../enums/portal.enums';

import { PortalBusinessAccessService } from './portal-business-access.service';
import { PortalFileStorageService, PortalUploadFile } from './portal-file-storage.service';
import { PortalNotificationService } from './portal-notification.service';
import { PortalReferenceService } from './portal-reference.service';

const POLICY_REQUEST_TYPES = new Set<PortalRequestType>([
  PortalRequestType.ENDORSEMENT,
  PortalRequestType.CANCELLATION,
  PortalRequestType.RENEWAL,
]);

const TERMINAL_REQUEST_STATUSES = new Set<PortalRequestStatus>([
  PortalRequestStatus.REJECTED,
  PortalRequestStatus.COMPLETED,
  PortalRequestStatus.CANCELLED,
]);

const OPEN_REQUEST_STATUSES = new Set<PortalRequestStatus>([
  PortalRequestStatus.DRAFT,
  PortalRequestStatus.SUBMITTED,
  PortalRequestStatus.IN_REVIEW,
  PortalRequestStatus.ADDITIONAL_INFO_REQUIRED,
  PortalRequestStatus.APPROVED,
]);

// DEDUPE_KEY_TYPES: request types that may have at most one open request
// per (portal account, target) at a time - see active_dedupe_key.
const DEDUPE_KEY_TYPES = new Set<PortalRequestType>([
  ...POLICY_REQUEST_TYPES,
  PortalRequestType.QUOTATION_ASSISTANCE,
]);

const REQUEST_TRANSITIONS: Record<PortalRequestStatus, PortalRequestStatus[]> = {
  [PortalRequestStatus.DRAFT]: [
    PortalRequestStatus.SUBMITTED,
    PortalRequestStatus.CANCELLED,
  ],
  [PortalRequestStatus.SUBMITTED]: [
    PortalRequestStatus.IN_REVIEW,
    PortalRequestStatus.ADDITIONAL_INFO_REQUIRED,
    PortalRequestStatus.REJECTED,
    PortalRequestStatus.CANCELLED,
  ],
  [PortalRequestStatus.IN_REVIEW]: [
    PortalRequestStatus.ADDITIONAL_INFO_REQUIRED,
    PortalRequestStatus.APPROVED,
    PortalRequestStatus.REJECTED,
  ],
  [PortalRequestStatus.ADDITIONAL_INFO_REQUIRED]: [
    PortalRequestStatus.SUBMITTED,
    PortalRequestStatus.CANCELLED,
  ],
  [PortalRequestStatus.APPROVED]: [PortalRequestStatus.COMPLETED],
  [PortalRequestStatus.REJECTED]: [],
  [PortalRequestStatus.COMPLETED]: [],
  [PortalRequestStatus.CANCELLED]: [],
};

const PAYMENT_PROOF_DOCUMENT_TYPE = 'PAYMENT_PROOF';
const POSTGRES_UNIQUE_VIOLATION = '23505';

@Injectable()
export class PortalRequestsService {
  private readonly logger = new Logger(PortalRequestsService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly accessService: PortalBusinessAccessService,
    private readonly referenceService: PortalReferenceService,
    private readonly notificationService: PortalNotificationService,
    private readonly fileStorageService: PortalFileStorageService,
    private readonly auditService: AuditService,
    @InjectRepository(PortalServiceRequest)
    private readonly requestRepository: Repository<PortalServiceRequest>,
    @InjectRepository(PortalServiceRequestEvent)
    private readonly eventRepository: Repository<PortalServiceRequestEvent>,
    @InjectRepository(PortalPaymentProof)
    private readonly paymentProofRepository: Repository<PortalPaymentProof>,
    @InjectRepository(PortalRequestAttachment)
    private readonly attachmentRepository: Repository<PortalRequestAttachment>,
  ) {}

  // =========================================================
  // POLICY REQUESTS
  // =========================================================

  async createPolicyRequest(
    account: PortalAccount,
    userId: string,
    dto: CreatePolicyPortalRequestDto,
  ) {
    if (!POLICY_REQUEST_TYPES.has(dto.request_type)) {
      throw new BadRequestException('Unsupported policy request type');
    }

    const policy = await this.accessService.assertPolicy(
      account,
      dto.policy_id,
    );

    const policyStatus = String(policy.policy_status).toUpperCase();

    if (
      dto.request_type === PortalRequestType.RENEWAL &&
      ['CANCELLED', 'VOID'].includes(policyStatus)
    ) {
      throw new ConflictException('Cancelled or void policy cannot be renewed');
    }

    if (
      [PortalRequestType.ENDORSEMENT, PortalRequestType.CANCELLATION].includes(
        dto.request_type,
      ) &&
      ['CANCELLED', 'VOID', 'EXPIRED'].includes(policyStatus)
    ) {
      throw new ConflictException(
        'The policy status does not allow this request',
      );
    }

    await this.assertNoDuplicateOpenRequest({
      accountId: account.id,
      requestType: dto.request_type,
      targetId: policy.id,
    });

    return this.createSubmittedRequest({
      account,
      userId,
      requestType: dto.request_type,
      targetType: 'POLICY',
      targetId: policy.id,
      policyId: policy.id,
      quotationId: null,
      invoiceId: null,
      subject: dto.subject,
      description: dto.description,
      payload: {
        requested_changes: dto.requested_changes ?? {},
        policy_no: policy.policy_no,
        policy_status: policy.policy_status,
        requested_at: new Date().toISOString(),
      },
    });
  }

  // =========================================================
  // CLAIM NOTIFICATION
  // =========================================================

  async createClaimNotification(
    account: PortalAccount,
    userId: string,
    dto: CreateClaimNotificationDto,
  ) {
    const policy = await this.accessService.assertPolicy(
      account,
      dto.policy_id,
    );

    const policyStatus = String(policy.policy_status).toUpperCase();

    if (['CANCELLED', 'VOID'].includes(policyStatus)) {
      throw new ConflictException(
        'A claim notification cannot be created for this policy status',
      );
    }

    const lossDate = dto.loss_date.slice(0, 10);
    const coverStart = String(policy.start_date).slice(0, 10);
    const coverEnd = String(policy.end_date).slice(0, 10);

    if (lossDate < coverStart || lossDate > coverEnd) {
      throw new BadRequestException(
        'Claim loss date must fall within the policy cover period',
      );
    }

    return this.createSubmittedRequest({
      account,
      userId,
      requestType: PortalRequestType.CLAIM_NOTIFICATION,
      targetType: 'POLICY',
      targetId: policy.id,
      policyId: policy.id,
      quotationId: null,
      invoiceId: null,
      subject: `Claim notification for ${policy.policy_no}`,
      description: dto.loss_description,
      payload: {
        policy_no: policy.policy_no,
        loss_date: lossDate,
        loss_location: dto.loss_location.trim(),
        loss_description: dto.loss_description.trim(),
        police_reference: dto.police_reference?.trim() ?? null,
        estimated_loss_amount: dto.estimated_loss_amount ?? null,
        notification_date: new Date().toISOString(),
      },
    });
  }

  // =========================================================
  // QUOTATION ASSISTANCE
  // =========================================================

  async createQuotationAssistance(
    account: PortalAccount,
    userId: string,
    dto: CreateQuotationAssistanceDto,
  ) {
    const quotation = await this.accessService.assertQuotation(
      account,
      dto.quotation_id,
    );

    await this.assertNoDuplicateOpenRequest({
      accountId: account.id,
      requestType: PortalRequestType.QUOTATION_ASSISTANCE,
      targetId: quotation.id,
    });

    return this.createSubmittedRequest({
      account,
      userId,
      requestType: PortalRequestType.QUOTATION_ASSISTANCE,
      targetType: 'QUOTATION',
      targetId: quotation.id,
      policyId: null,
      quotationId: quotation.id,
      invoiceId: null,
      subject: dto.subject,
      description: dto.description,
      payload: {
        quotation_no: quotation.quotation_no,
        quotation_status: quotation.status,
      },
    });
  }

  // =========================================================
  // PAYMENT PROOF
  //
  // Verification never marks the invoice PAID, and never touches
  // paid_amount/balance_amount/receipts/payment allocations directly -
  // those changes belong to the finance module.
  // =========================================================

  async createPaymentProof(
    account: PortalAccount,
    userId: string,
    dto: CreatePaymentProofDto,
  ) {
    const scopedInvoice = await this.accessService.assertInvoice(
      account,
      dto.invoice_id,
    );

    const result = await this.dataSource.transaction(async (manager) => {
      const invoice = await manager
        .getRepository(Invoice)
        .createQueryBuilder('invoice')
        .setLock('pessimistic_write')
        .where('invoice.id = :invoiceId', { invoiceId: scopedInvoice.id })
        .andWhere('invoice.deleted_at IS NULL')
        .getOne();

      if (!invoice) {
        throw new NotFoundException('Invoice not found');
      }

      const invoiceStatus = String(invoice.status).toUpperCase();

      if (['VOID', 'CANCELLED', 'PAID'].includes(invoiceStatus)) {
        throw new ConflictException(
          'Invoice is not available for payment proof',
        );
      }

      const balance = Number(invoice.balance_amount);

      if (!Number.isFinite(balance) || balance <= 0) {
        throw new ConflictException('Invoice has no outstanding balance');
      }

      if (dto.amount > balance) {
        throw new BadRequestException(
          'Payment proof amount cannot exceed the invoice balance',
        );
      }

      await this.assertNoActivePaymentProof(manager, account.id, invoice.id);

      const requestNo = await this.referenceService.next(
        account.company_id,
        'PORTAL_REQUEST',
        'PRQ',
        manager,
      );

      const requestRepository = manager.getRepository(PortalServiceRequest);

      const request = await requestRepository.save(
        requestRepository.create({
          company_id: account.company_id,
          portal_account_id: account.id,
          request_no: requestNo,
          request_type: PortalRequestType.PAYMENT_PROOF,
          target_type: 'INVOICE',
          target_id: invoice.id,
          policy_id: invoice.policy_id,
          quotation_id: invoice.quotation_id,
          invoice_id: invoice.id,
          status: PortalRequestStatus.SUBMITTED,
          subject: `Payment proof for ${invoice.invoice_no}`,
          description: dto.description.trim(),
          payload: {
            invoice_no: invoice.invoice_no,
            invoice_balance_at_submission: invoice.balance_amount,
          },
          submitted_by: userId,
          submitted_at: new Date(),
          created_by: userId,
          updated_by: userId,
        }),
      );

      const proofRepository = manager.getRepository(PortalPaymentProof);

      const proof = await proofRepository.save(
        proofRepository.create({
          company_id: account.company_id,
          request_id: request.id,
          invoice_id: invoice.id,
          amount: dto.amount.toFixed(2),
          currency: invoice.currency,
          payment_reference: dto.payment_reference?.trim() ?? null,
          payment_date: dto.payment_date.slice(0, 10),
          status: PortalPaymentProofStatus.PENDING_REVIEW,
        }),
      );

      await this.recordEvent(
        manager,
        request.id,
        null,
        PortalRequestStatus.SUBMITTED,
        'Payment proof submitted for finance review',
        userId,
      );

      return { request, payment_proof: proof };
    });

    await this.auditSafely({
      userId,
      companyId: account.company_id,
      action: 'portal.payment_proof.submitted',
      resource: 'portal_service_request',
      resourceId: result.request.id,
      metadata: {
        invoiceId: result.payment_proof.invoice_id,
        amount: result.payment_proof.amount,
        currency: result.payment_proof.currency,
      },
    });

    return {
      request: this.mapRequest(result.request),
      payment_proof: {
        id: result.payment_proof.id,
        invoice_id: result.payment_proof.invoice_id,
        amount: result.payment_proof.amount,
        currency: result.payment_proof.currency,
        payment_reference: result.payment_proof.payment_reference,
        payment_date: result.payment_proof.payment_date,
        status: result.payment_proof.status,
      },
      attachment_required: true,
      required_document_type: PAYMENT_PROOF_DOCUMENT_TYPE,
      message:
        'Payment proof request created. Upload the payment evidence for finance review.',
    };
  }

  // =========================================================
  // PORTAL USER REQUEST QUERIES
  // =========================================================

  async findMine(account: PortalAccount, query: PortalRequestFilterDto) {
    const { page, limit } = this.pagination(query);

    const qb = this.requestRepository
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.policy', 'policy')
      .leftJoinAndSelect('request.quotation', 'quotation')
      .leftJoinAndSelect('request.invoice', 'invoice')
      .where('request.portal_account_id = :accountId', {
        accountId: account.id,
      })
      .andWhere('request.deleted_at IS NULL');

    this.applyRequestFilters(qb, query);

    qb.orderBy('request.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();

    return {
      items: items.map((item) => this.mapRequest(item)),
      meta: this.paginationMeta(page, limit, total),
    };
  }

  async findMineOne(account: PortalAccount, id: string) {
    const request = await this.requestRepository.findOne({
      where: { id, portal_account_id: account.id },
      relations: {
        policy: true,
        quotation: true,
        invoice: true,
        payment_proof: true,
        attachments: true,
        events: true,
      },
      order: {
        events: { created_at: 'ASC' },
        attachments: { created_at: 'ASC' },
      },
    });

    if (!request) {
      throw new NotFoundException('Portal request not found');
    }

    return this.mapRequestDetail(request);
  }

  async cancelMine(account: PortalAccount, userId: string, requestId: string) {
    return this.transitionPortalOwnedRequest({
      account,
      requestId,
      changedBy: userId,
      newStatus: PortalRequestStatus.CANCELLED,
      allowedCurrentStatuses: [
        PortalRequestStatus.DRAFT,
        PortalRequestStatus.SUBMITTED,
        PortalRequestStatus.ADDITIONAL_INFO_REQUIRED,
      ],
      reason: 'Cancelled by portal user',
    });
  }

  async resubmitMine(
    account: PortalAccount,
    userId: string,
    requestId: string,
  ) {
    return this.transitionPortalOwnedRequest({
      account,
      requestId,
      changedBy: userId,
      newStatus: PortalRequestStatus.SUBMITTED,
      allowedCurrentStatuses: [PortalRequestStatus.ADDITIONAL_INFO_REQUIRED],
      reason: 'Additional information submitted by portal user',
    });
  }

  // =========================================================
  // COMPANY REQUEST QUERIES
  // =========================================================

  async findCompanyRequests(companyId: string, query: PortalRequestFilterDto) {
    const { page, limit } = this.pagination(query);

    const qb = this.requestRepository
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.portal_account', 'portalAccount')
      .leftJoinAndSelect('portalAccount.user', 'portalUser')
      .leftJoinAndSelect('portalAccount.customer', 'customer')
      .leftJoinAndSelect(
        'portalAccount.intermediary_company',
        'intermediaryCompany',
      )
      .leftJoinAndSelect('request.policy', 'policy')
      .leftJoinAndSelect('request.quotation', 'quotation')
      .leftJoinAndSelect('request.invoice', 'invoice')
      .where('request.company_id = :companyId', { companyId })
      .andWhere('request.deleted_at IS NULL');

    this.applyRequestFilters(qb, query);

    qb.orderBy('request.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();

    return {
      items: items.map((item) => this.mapCompanyRequest(item)),
      meta: this.paginationMeta(page, limit, total),
    };
  }

  async findCompanyRequestDetail(companyId: string, requestId: string) {
    const request = await this.requestRepository.findOne({
      where: { id: requestId, company_id: companyId },
      relations: {
        portal_account: {
          user: true,
          customer: true,
          intermediary_company: true,
        },
        policy: true,
        quotation: true,
        invoice: true,
        payment_proof: true,
        attachments: true,
        events: true,
        assignee: true,
      },
      order: {
        events: { created_at: 'ASC' },
        attachments: { created_at: 'ASC' },
      },
    });

    if (!request) {
      throw new NotFoundException('Portal request not found');
    }

    return this.mapCompanyRequestDetail(request);
  }

  // =========================================================
  // ASSIGNMENT
  // =========================================================

  async assign(
    companyId: string,
    requestId: string,
    changedBy: string,
    dto: AssignPortalRequestDto,
  ) {
    const result = await this.dataSource.transaction(async (manager) => {
      const membership = await manager.getRepository(CompanyUser).findOne({
        where: {
          company_id: companyId,
          user_id: dto.assigned_to,
          status: 'active',
        },
      });

      if (!membership) {
        throw new BadRequestException('Assignee is not an active company user');
      }

      const request = await this.lockCompanyRequest(
        manager,
        companyId,
        requestId,
      );

      if (TERMINAL_REQUEST_STATUSES.has(request.status)) {
        throw new ConflictException(
          'A completed, rejected, or cancelled request cannot be assigned',
        );
      }

      const oldStatus = request.status;

      request.assigned_to = dto.assigned_to;
      request.assigned_at = new Date();
      request.updated_by = changedBy;

      if (request.status === PortalRequestStatus.SUBMITTED) {
        request.status = PortalRequestStatus.IN_REVIEW;
        request.reviewed_by = changedBy;
        request.reviewed_at = new Date();
      }

      const saved = await manager
        .getRepository(PortalServiceRequest)
        .save(request);

      await this.recordEvent(
        manager,
        request.id,
        oldStatus,
        request.status,
        dto.message?.trim() ?? 'Request assigned for review',
        changedBy,
        { assigned_to: dto.assigned_to },
      );

      return saved;
    });

    await this.notifyStatusChangeSafely(
      result,
      result.status,
      result.status,
      `Your request ${result.request_no} has been assigned for review.`,
    );

    await this.auditSafely({
      userId: changedBy,
      companyId,
      action: 'portal.request.assigned',
      resource: 'portal_service_request',
      resourceId: result.id,
      metadata: { assignedTo: dto.assigned_to },
    });

    return this.mapRequest(result);
  }

  // =========================================================
  // COMPANY STATUS TRANSITIONS
  // =========================================================

  async transitionCompanyRequest(
    companyId: string,
    requestId: string,
    changedBy: string,
    dto: TransitionPortalRequestDto,
  ) {
    if (dto.status === PortalRequestStatus.COMPLETED) {
      throw new ConflictException('Use the dedicated complete action');
    }

    const result = await this.dataSource.transaction(async (manager) => {
      const request = await this.lockCompanyRequest(
        manager,
        companyId,
        requestId,
      );

      if (
        request.request_type === PortalRequestType.PAYMENT_PROOF &&
        dto.status === PortalRequestStatus.APPROVED
      ) {
        throw new ConflictException(
          'Use the dedicated payment-proof review action',
        );
      }

      const allowed = REQUEST_TRANSITIONS[request.status] ?? [];

      if (!allowed.includes(dto.status)) {
        throw new ConflictException(
          `Cannot change portal request from ${request.status} to ${dto.status}`,
        );
      }

      this.assertReasonRequired(dto.status, dto.reason);

      return this.applyTransition(
        manager,
        request,
        dto.status,
        changedBy,
        dto.reason,
      );
    });

    await this.afterStatusChange(
      result.request,
      result.oldStatus,
      result.request.status,
      changedBy,
      dto.reason,
    );

    return this.mapRequest(result.request);
  }

  // =========================================================
  // COMPLETE REQUEST
  // =========================================================

  async completeCompanyRequest(
    companyId: string,
    requestId: string,
    changedBy: string,
    dto: CompletePortalRequestDto,
  ) {
    const result = await this.dataSource.transaction(async (manager) => {
      const request = await this.lockCompanyRequest(
        manager,
        companyId,
        requestId,
      );

      if (request.status !== PortalRequestStatus.APPROVED) {
        throw new ConflictException(
          'Only an approved portal request can be completed',
        );
      }

      await this.assertCompletionEvidence(manager, request, dto);

      request.payload = {
        ...(request.payload ?? {}),
        execution_result: {
          result_type: dto.result_type ?? null,
          result_id: dto.result_id ?? null,
          result_reference: dto.result_reference ?? null,
          completed_at: new Date().toISOString(),
          completed_by: changedBy,
        },
      };

      return this.applyTransition(
        manager,
        request,
        PortalRequestStatus.COMPLETED,
        changedBy,
        dto.reason ?? 'Portal request completed by the company',
      );
    });

    await this.afterStatusChange(
      result.request,
      result.oldStatus,
      result.request.status,
      changedBy,
      dto.reason,
    );

    return this.mapRequest(result.request);
  }

  // =========================================================
  // PAYMENT PROOF REVIEW
  // =========================================================

  async reviewPaymentProof(
    companyId: string,
    requestId: string,
    changedBy: string,
    dto: ReviewPaymentProofDto,
  ) {
    const result = await this.dataSource.transaction(async (manager) => {
      const request = await this.lockCompanyRequest(
        manager,
        companyId,
        requestId,
      );

      if (request.request_type !== PortalRequestType.PAYMENT_PROOF) {
        throw new BadRequestException('Request is not a payment proof');
      }

      if (
        ![PortalRequestStatus.SUBMITTED, PortalRequestStatus.IN_REVIEW].includes(
          request.status,
        )
      ) {
        throw new ConflictException(
          'Payment proof request is not awaiting review',
        );
      }

      const proof = await manager
        .getRepository(PortalPaymentProof)
        .createQueryBuilder('proof')
        .setLock('pessimistic_write')
        .where('proof.request_id = :requestId', { requestId: request.id })
        .andWhere('proof.company_id = :companyId', { companyId })
        .getOne();

      if (!proof) {
        throw new NotFoundException('Payment proof not found');
      }

      if (proof.status !== PortalPaymentProofStatus.PENDING_REVIEW) {
        throw new ConflictException('Payment proof has already been reviewed');
      }

      if (
        dto.status === PortalPaymentProofStatus.REJECTED &&
        !dto.reason?.trim()
      ) {
        throw new BadRequestException('A rejection reason is required');
      }

      if (dto.status === PortalPaymentProofStatus.VERIFIED) {
        const attachmentCount = await manager
          .getRepository(PortalRequestAttachment)
          .createQueryBuilder('attachment')
          .where('attachment.request_id = :requestId', { requestId: request.id })
          .andWhere('attachment.company_id = :companyId', { companyId })
          .andWhere('attachment.status = :status', {
            status: PortalAttachmentStatus.ACTIVE,
          })
          .andWhere('attachment.document_type = :documentType', {
            documentType: PAYMENT_PROOF_DOCUMENT_TYPE,
          })
          .getCount();

        if (attachmentCount === 0) {
          throw new ConflictException(
            'A PAYMENT_PROOF attachment is required before verification',
          );
        }

        const invoice = await manager
          .getRepository(Invoice)
          .createQueryBuilder('invoice')
          .setLock('pessimistic_write')
          .where('invoice.id = :invoiceId', { invoiceId: proof.invoice_id })
          .andWhere('invoice.deleted_at IS NULL')
          .getOne();

        if (!invoice) {
          throw new NotFoundException('Related invoice not found');
        }

        const invoiceStatus = String(invoice.status).toUpperCase();

        if (['VOID', 'CANCELLED', 'PAID'].includes(invoiceStatus)) {
          throw new ConflictException(
            'Related invoice is no longer available for payment-proof verification',
          );
        }

        const balance = Number(invoice.balance_amount);

        if (Number(proof.amount) > balance) {
          throw new ConflictException(
            'Payment proof amount now exceeds the current invoice balance',
          );
        }
      }

      proof.status = dto.status;
      proof.reviewed_by = changedBy;
      proof.reviewed_at = new Date();
      proof.review_reason = dto.reason?.trim() ?? null;

      await manager.getRepository(PortalPaymentProof).save(proof);

      const newStatus =
        dto.status === PortalPaymentProofStatus.VERIFIED
          ? PortalRequestStatus.APPROVED
          : PortalRequestStatus.REJECTED;

      const transition = await this.applyTransition(
        manager,
        request,
        newStatus,
        changedBy,
        dto.reason ??
          (dto.status === PortalPaymentProofStatus.VERIFIED
            ? 'Payment proof verified by finance'
            : 'Payment proof rejected by finance'),
      );

      return { ...transition, proof };
    });

    await this.afterStatusChange(
      result.request,
      result.oldStatus,
      result.request.status,
      changedBy,
      dto.reason,
    );

    return {
      request: this.mapRequest(result.request),
      payment_proof: {
        id: result.proof.id,
        status: result.proof.status,
        reviewed_by: result.proof.reviewed_by,
        reviewed_at: result.proof.reviewed_at,
        review_reason: result.proof.review_reason,
      },
      message:
        dto.status === PortalPaymentProofStatus.VERIFIED
          ? 'Payment proof verified. The invoice remains unpaid until finance posts an official receipt or payment allocation.'
          : 'Payment proof rejected.',
    };
  }

  // =========================================================
  // ATTACHMENTS
  // =========================================================

  async uploadAttachment(
    account: PortalAccount,
    userId: string,
    requestId: string,
    documentType: string,
    file: PortalUploadFile,
  ) {
    const request = await this.findPortalOwnedRequestEntity(
      account.id,
      requestId,
    );

    if (TERMINAL_REQUEST_STATUSES.has(request.status)) {
      throw new ConflictException('Attachments cannot be added to this request');
    }

    const normalizedDocumentType = documentType
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, '_');

    if (!normalizedDocumentType) {
      throw new BadRequestException('Document type is required');
    }

    const stored = await this.fileStorageService.store({
      companyId: account.company_id,
      requestId: request.id,
      file,
    });

    try {
      const attachment = await this.attachmentRepository.save(
        this.attachmentRepository.create({
          company_id: account.company_id,
          request_id: request.id,
          uploaded_by: userId,
          document_type: normalizedDocumentType,
          original_file_name: stored.originalFileName,
          stored_file_name: stored.storedFileName,
          storage_key: stored.storageKey,
          mime_type: stored.mimeType,
          file_size: stored.fileSize,
          checksum: stored.checksum,
          status: PortalAttachmentStatus.ACTIVE,
        }),
      );

      await this.auditSafely({
        userId,
        companyId: account.company_id,
        action: 'portal.attachment.uploaded',
        resource: 'portal_service_request',
        resourceId: request.id,
        metadata: {
          attachmentId: attachment.id,
          documentType: attachment.document_type,
          checksum: attachment.checksum,
        },
      });

      return {
        id: attachment.id,
        document_type: attachment.document_type,
        original_file_name: attachment.original_file_name,
        mime_type: attachment.mime_type,
        file_size: attachment.file_size,
        checksum: attachment.checksum,
        created_at: attachment.created_at,
      };
    } catch (error) {
      await this.fileStorageService.remove(stored.storageKey).catch(
        (cleanupError) => {
          this.logger.error(
            'Failed to clean up orphan portal upload',
            cleanupError instanceof Error
              ? cleanupError.stack
              : String(cleanupError),
          );
        },
      );

      throw error;
    }
  }

  async readMineAttachment(account: PortalAccount, attachmentId: string) {
    const attachment = await this.attachmentRepository.findOne({
      where: {
        id: attachmentId,
        company_id: account.company_id,
        status: PortalAttachmentStatus.ACTIVE,
      },
      relations: { request: true },
    });

    if (!attachment || attachment.request.portal_account_id !== account.id) {
      throw new NotFoundException('Portal attachment not found');
    }

    return {
      attachment,
      buffer: await this.fileStorageService.read(attachment.storage_key),
    };
  }

  async readCompanyAttachment(companyId: string, attachmentId: string) {
    const attachment = await this.attachmentRepository.findOne({
      where: {
        id: attachmentId,
        company_id: companyId,
        status: PortalAttachmentStatus.ACTIVE,
      },
      relations: { request: true },
    });

    if (!attachment) {
      throw new NotFoundException('Portal attachment not found');
    }

    return {
      attachment,
      buffer: await this.fileStorageService.read(attachment.storage_key),
    };
  }

  // =========================================================
  // CREATION HELPERS
  // =========================================================

  private async createSubmittedRequest(params: {
    account: PortalAccount;
    userId: string;
    requestType: PortalRequestType;
    targetType: string | null;
    targetId: string | null;
    policyId: string | null;
    quotationId: string | null;
    invoiceId: string | null;
    subject: string;
    description: string;
    payload: Record<string, unknown>;
  }) {
    let request: PortalServiceRequest;

    try {
      request = await this.dataSource.transaction(async (manager) => {
        const requestNo = await this.referenceService.next(
          params.account.company_id,
          'PORTAL_REQUEST',
          'PRQ',
          manager,
        );

        const repository = manager.getRepository(PortalServiceRequest);

        const activeDedupeKey = DEDUPE_KEY_TYPES.has(params.requestType)
          ? `${params.account.id}:${params.requestType}:${params.targetId}`
          : null;

        const created = await repository.save(
          repository.create({
            company_id: params.account.company_id,
            portal_account_id: params.account.id,
            request_no: requestNo,
            request_type: params.requestType,
            target_type: params.targetType,
            target_id: params.targetId,
            policy_id: params.policyId,
            quotation_id: params.quotationId,
            invoice_id: params.invoiceId,
            status: PortalRequestStatus.SUBMITTED,
            subject: params.subject.trim(),
            description: params.description.trim(),
            payload: params.payload,
            submitted_by: params.userId,
            submitted_at: new Date(),
            created_by: params.userId,
            updated_by: params.userId,
            active_dedupe_key: activeDedupeKey,
          }),
        );

        await this.recordEvent(
          manager,
          created.id,
          null,
          PortalRequestStatus.SUBMITTED,
          'Request submitted through the portal',
          params.userId,
        );

        return created;
      });
    } catch (error) {
      // Defense-in-depth: the count-based assertNoDuplicateOpenRequest check
      // can race under concurrent requests. The partial unique index on
      // active_dedupe_key is the real backstop - surface its violation the
      // same way as the application-level check.
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(
          'An open request of this type already exists for this record',
        );
      }

      throw error;
    }

    await this.auditSafely({
      userId: params.userId,
      companyId: params.account.company_id,
      action: 'portal.request.submitted',
      resource: 'portal_service_request',
      resourceId: request.id,
      metadata: {
        requestType: request.request_type,
        targetType: request.target_type,
        targetId: request.target_id,
      },
    });

    return this.mapRequest(request);
  }

  private isUniqueViolation(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }

    const driverCode = (error as unknown as { code?: string }).code;
    const nestedCode = (
      error as unknown as { driverError?: { code?: string } }
    ).driverError?.code;

    return (
      driverCode === POSTGRES_UNIQUE_VIOLATION ||
      nestedCode === POSTGRES_UNIQUE_VIOLATION
    );
  }

  private async assertNoDuplicateOpenRequest(params: {
    accountId: string;
    requestType: PortalRequestType;
    targetId: string;
  }) {
    const count = await this.requestRepository
      .createQueryBuilder('request')
      .where('request.portal_account_id = :accountId', {
        accountId: params.accountId,
      })
      .andWhere('request.request_type = :requestType', {
        requestType: params.requestType,
      })
      .andWhere('request.target_id = :targetId', { targetId: params.targetId })
      .andWhere('request.status IN (:...statuses)', {
        statuses: Array.from(OPEN_REQUEST_STATUSES),
      })
      .andWhere('request.deleted_at IS NULL')
      .getCount();

    if (count > 0) {
      throw new ConflictException(
        'An open request of this type already exists for this record',
      );
    }
  }

  private async assertNoActivePaymentProof(
    manager: EntityManager,
    accountId: string,
    invoiceId: string,
  ) {
    const rows = await manager.query(
      `
      SELECT request.id
      FROM portal_service_requests request
      INNER JOIN portal_payment_proofs proof ON proof.request_id = request.id
      WHERE request.portal_account_id = $1
        AND request.invoice_id = $2
        AND request.deleted_at IS NULL
        AND request.status IN (
          'DRAFT', 'SUBMITTED', 'IN_REVIEW', 'ADDITIONAL_INFO_REQUIRED', 'APPROVED'
        )
        AND proof.status IN ('PENDING_REVIEW', 'VERIFIED')
      LIMIT 1
      FOR UPDATE
      `,
      [accountId, invoiceId],
    );

    if (rows[0]) {
      throw new ConflictException(
        'An active payment-proof request already exists for this invoice',
      );
    }
  }

  // =========================================================
  // TRANSITION HELPERS
  // =========================================================

  private async transitionPortalOwnedRequest(params: {
    account: PortalAccount;
    requestId: string;
    changedBy: string;
    newStatus: PortalRequestStatus;
    allowedCurrentStatuses: PortalRequestStatus[];
    reason: string;
  }) {
    const result = await this.dataSource.transaction(async (manager) => {
      const request = await this.lockPortalOwnedRequest(
        manager,
        params.account.id,
        params.requestId,
      );

      if (!params.allowedCurrentStatuses.includes(request.status)) {
        throw new ConflictException(
          `Request cannot be changed from ${request.status} to ${params.newStatus}`,
        );
      }

      return this.applyTransition(
        manager,
        request,
        params.newStatus,
        params.changedBy,
        params.reason,
      );
    });

    await this.afterStatusChange(
      result.request,
      result.oldStatus,
      result.request.status,
      params.changedBy,
      params.reason,
    );

    return this.mapRequest(result.request);
  }

  private async applyTransition(
    manager: EntityManager,
    request: PortalServiceRequest,
    newStatus: PortalRequestStatus,
    changedBy: string,
    reason?: string,
  ) {
    const oldStatus = request.status;

    request.status = newStatus;
    request.updated_by = changedBy;

    if (
      [
        PortalRequestStatus.IN_REVIEW,
        PortalRequestStatus.ADDITIONAL_INFO_REQUIRED,
        PortalRequestStatus.APPROVED,
        PortalRequestStatus.REJECTED,
      ].includes(newStatus)
    ) {
      request.reviewed_by = changedBy;
      request.reviewed_at = new Date();
      request.decision_reason = reason?.trim() ?? null;
    }

    if (newStatus === PortalRequestStatus.SUBMITTED) {
      request.submitted_by = changedBy;
      request.submitted_at = new Date();

      // Clear the previous information-request decision after resubmission.
      if (oldStatus === PortalRequestStatus.ADDITIONAL_INFO_REQUIRED) {
        request.decision_reason = null;
      }
    }

    if (newStatus === PortalRequestStatus.COMPLETED) {
      request.completed_by = changedBy;
      request.completed_at = new Date();
    }

    if (TERMINAL_REQUEST_STATUSES.has(newStatus)) {
      request.active_dedupe_key = null;
    }

    const saved = await manager.getRepository(PortalServiceRequest).save(request);

    await this.recordEvent(
      manager,
      request.id,
      oldStatus,
      newStatus,
      reason?.trim() ?? null,
      changedBy,
    );

    return { request: saved, oldStatus };
  }

  private async lockCompanyRequest(
    manager: EntityManager,
    companyId: string,
    requestId: string,
  ) {
    const request = await manager
      .getRepository(PortalServiceRequest)
      .createQueryBuilder('request')
      .setLock('pessimistic_write')
      .where('request.id = :requestId', { requestId })
      .andWhere('request.company_id = :companyId', { companyId })
      .andWhere('request.deleted_at IS NULL')
      .getOne();

    if (!request) {
      throw new NotFoundException('Portal request not found');
    }

    return request;
  }

  private async lockPortalOwnedRequest(
    manager: EntityManager,
    accountId: string,
    requestId: string,
  ) {
    const request = await manager
      .getRepository(PortalServiceRequest)
      .createQueryBuilder('request')
      .setLock('pessimistic_write')
      .where('request.id = :requestId', { requestId })
      .andWhere('request.portal_account_id = :accountId', { accountId })
      .andWhere('request.deleted_at IS NULL')
      .getOne();

    if (!request) {
      throw new NotFoundException('Portal request not found');
    }

    return request;
  }

  private async findPortalOwnedRequestEntity(
    accountId: string,
    requestId: string,
  ) {
    const request = await this.requestRepository.findOne({
      where: { id: requestId, portal_account_id: accountId },
    });

    if (!request) {
      throw new NotFoundException('Portal request not found');
    }

    return request;
  }

  private assertReasonRequired(
    newStatus: PortalRequestStatus,
    reason?: string,
  ) {
    if (
      [
        PortalRequestStatus.ADDITIONAL_INFO_REQUIRED,
        PortalRequestStatus.REJECTED,
      ].includes(newStatus) &&
      !reason?.trim()
    ) {
      throw new BadRequestException('A reason is required for this status');
    }
  }

  private async assertCompletionEvidence(
    manager: EntityManager,
    request: PortalServiceRequest,
    dto: CompletePortalRequestDto,
  ) {
    if (request.request_type === PortalRequestType.QUOTATION_ASSISTANCE) {
      return;
    }

    if (request.request_type === PortalRequestType.PAYMENT_PROOF) {
      const proof = await manager.getRepository(PortalPaymentProof).findOne({
        where: { request_id: request.id, company_id: request.company_id },
      });

      if (!proof || proof.status !== PortalPaymentProofStatus.VERIFIED) {
        throw new ConflictException(
          'Payment proof must be verified before completion',
        );
      }

      if (!dto.result_reference?.trim()) {
        throw new BadRequestException(
          'Official receipt or payment-allocation reference is required before completing a payment-proof request',
        );
      }

      return;
    }

    if (request.request_type === PortalRequestType.CLAIM_NOTIFICATION) {
      if (!dto.result_id || !dto.result_reference?.trim()) {
        throw new BadRequestException(
          'Created claim ID and claim reference are required before completing a claim-notification request',
        );
      }

      return;
    }

    if (
      POLICY_REQUEST_TYPES.has(request.request_type) &&
      !dto.result_reference?.trim()
    ) {
      throw new BadRequestException(
        'Operational policy transaction reference is required before completing this request',
      );
    }
  }

  // =========================================================
  // EVENT, NOTIFICATION AND AUDIT HELPERS
  // =========================================================

  private async recordEvent(
    manager: EntityManager,
    requestId: string,
    oldStatus: PortalRequestStatus | null,
    newStatus: PortalRequestStatus,
    message: string | null,
    changedBy: string,
    metadata: Record<string, unknown> = {},
  ) {
    const repository = manager.getRepository(PortalServiceRequestEvent);

    await repository.save(
      repository.create({
        request_id: requestId,
        old_status: oldStatus,
        new_status: newStatus,
        message,
        changed_by: changedBy,
        metadata,
      }),
    );
  }

  private async afterStatusChange(
    request: PortalServiceRequest,
    oldStatus: PortalRequestStatus,
    newStatus: PortalRequestStatus,
    changedBy: string,
    reason?: string,
  ) {
    // Notification failures never roll back the (already committed)
    // business action.
    await Promise.all([
      this.notifyStatusChangeSafely(request, oldStatus, newStatus, reason),
      this.auditSafely({
        userId: changedBy,
        companyId: request.company_id,
        action: 'portal.request.status_changed',
        resource: 'portal_service_request',
        resourceId: request.id,
        metadata: { oldStatus, newStatus, reason: reason ?? null },
      }),
    ]);
  }

  private async notifyStatusChangeSafely(
    request: PortalServiceRequest,
    oldStatus: PortalRequestStatus,
    newStatus: PortalRequestStatus,
    reason?: string,
  ) {
    try {
      const account = await this.dataSource.getRepository(PortalAccount).findOne({
        where: { id: request.portal_account_id },
      });

      if (!account) {
        return;
      }

      const severity =
        newStatus === PortalRequestStatus.REJECTED
          ? PortalNotificationSeverity.ERROR
          : newStatus === PortalRequestStatus.COMPLETED
            ? PortalNotificationSeverity.SUCCESS
            : newStatus === PortalRequestStatus.ADDITIONAL_INFO_REQUIRED
              ? PortalNotificationSeverity.WARNING
              : PortalNotificationSeverity.INFO;

      await this.notificationService.create({
        companyId: request.company_id,
        userId: account.user_id,
        type: 'PORTAL_REQUEST_STATUS_CHANGED',
        severity,
        title: `Request ${request.request_no} updated`,
        message: [
          `Your request status changed from ${oldStatus} to ${newStatus}.`,
          reason?.trim() ? `Reason: ${reason.trim()}` : null,
        ]
          .filter(Boolean)
          .join(' '),
        resourceType: 'portal-service-request',
        resourceId: request.id,
        actionUrl: `/portal/requests/${request.id}`,
      });
    } catch (error) {
      this.logger.error(
        `Failed to create portal notification for request ${request.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async auditSafely(params: {
    userId: string;
    companyId: string;
    action: string;
    resource: string;
    resourceId: string;
    metadata?: Record<string, unknown>;
  }) {
    try {
      await this.auditService.log({
        userId: params.userId,
        companyId: params.companyId,
        action: params.action,
        resource: params.resource,
        resourceId: params.resourceId,
        metadata: params.metadata ?? {},
      });
    } catch (error) {
      // The transactional request-event record remains the primary
      // durable status history.
      this.logger.error(
        `Failed to write audit log for ${params.resourceId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  // =========================================================
  // FILTERS AND RESPONSE MAPPING
  // =========================================================

  private applyRequestFilters(
    qb: SelectQueryBuilder<PortalServiceRequest>,
    query: PortalRequestFilterDto,
  ) {
    if (query.request_type) {
      qb.andWhere('request.request_type = :requestType', {
        requestType: query.request_type,
      });
    }

    if (query.status) {
      qb.andWhere('request.status = :status', { status: query.status });
    }

    if (query.search?.trim()) {
      const search = `%${query.search.trim()}%`;

      qb.andWhere(
        new Brackets((builder) => {
          builder
            .where('request.request_no ILIKE :search', { search })
            .orWhere('request.subject ILIKE :search');
        }),
      );
    }
  }

  private mapRequest(request: PortalServiceRequest) {
    return {
      id: request.id,
      request_no: request.request_no,
      request_type: request.request_type,
      status: request.status,
      subject: request.subject,
      description: request.description,
      target_type: request.target_type,
      target_id: request.target_id,
      policy: request.policy
        ? {
            id: request.policy.id,
            policy_no: request.policy.policy_no,
            policy_status: request.policy.policy_status,
          }
        : null,
      quotation: request.quotation
        ? {
            id: request.quotation.id,
            quotation_no: request.quotation.quotation_no,
            status: request.quotation.status,
          }
        : null,
      invoice: request.invoice
        ? {
            id: request.invoice.id,
            invoice_no: request.invoice.invoice_no,
            status: request.invoice.status,
            currency: request.invoice.currency,
            balance_amount: request.invoice.balance_amount,
          }
        : null,
      submitted_at: request.submitted_at,
      assigned_at: request.assigned_at,
      reviewed_at: request.reviewed_at,
      decision_reason: request.decision_reason,
      completed_at: request.completed_at,
      created_at: request.created_at,
      updated_at: request.updated_at,
    };
  }

  private mapRequestDetail(request: PortalServiceRequest) {
    return {
      ...this.mapRequest(request),
      payload: request.payload,
      payment_proof: request.payment_proof
        ? {
            id: request.payment_proof.id,
            amount: request.payment_proof.amount,
            currency: request.payment_proof.currency,
            payment_reference: request.payment_proof.payment_reference,
            payment_date: request.payment_proof.payment_date,
            status: request.payment_proof.status,
            reviewed_at: request.payment_proof.reviewed_at,
            review_reason: request.payment_proof.review_reason,
          }
        : null,
      attachments:
        request.attachments
          ?.filter(
            (attachment) => attachment.status === PortalAttachmentStatus.ACTIVE,
          )
          .map((attachment) => ({
            id: attachment.id,
            document_type: attachment.document_type,
            original_file_name: attachment.original_file_name,
            mime_type: attachment.mime_type,
            file_size: attachment.file_size,
            checksum: attachment.checksum,
            created_at: attachment.created_at,
          })) ?? [],
      events:
        request.events?.map((event) => ({
          id: event.id,
          old_status: event.old_status,
          new_status: event.new_status,
          message: event.message,
          created_at: event.created_at,
        })) ?? [],
    };
  }

  private mapCompanyRequest(request: PortalServiceRequest) {
    return {
      ...this.mapRequest(request),
      portal_actor: request.portal_account
        ? {
            account_id: request.portal_account.id,
            actor_type: request.portal_account.actor_type,
            user: request.portal_account.user
              ? {
                  id: request.portal_account.user.id,
                  name: [
                    request.portal_account.user.first_name,
                    request.portal_account.user.last_name,
                  ]
                    .filter(Boolean)
                    .join(' '),
                  email: request.portal_account.user.email,
                  phone: request.portal_account.user.phone,
                }
              : null,
            customer: request.portal_account.customer
              ? {
                  id: request.portal_account.customer.id,
                  customer_no: request.portal_account.customer.customer_no,
                }
              : null,
            intermediary_company: request.portal_account.intermediary_company
              ? {
                  id: request.portal_account.intermediary_company.id,
                  name: request.portal_account.intermediary_company.name,
                }
              : null,
          }
        : null,
    };
  }

  private mapCompanyRequestDetail(request: PortalServiceRequest) {
    return {
      ...this.mapCompanyRequest(request),
      payload: request.payload,
      assigned_to: request.assignee
        ? {
            id: request.assignee.id,
            name: [request.assignee.first_name, request.assignee.last_name]
              .filter(Boolean)
              .join(' '),
          }
        : null,
      payment_proof: request.payment_proof
        ? {
            id: request.payment_proof.id,
            amount: request.payment_proof.amount,
            currency: request.payment_proof.currency,
            payment_reference: request.payment_proof.payment_reference,
            payment_date: request.payment_proof.payment_date,
            status: request.payment_proof.status,
            reviewed_by: request.payment_proof.reviewed_by,
            reviewed_at: request.payment_proof.reviewed_at,
            review_reason: request.payment_proof.review_reason,
          }
        : null,
      attachments:
        request.attachments
          ?.filter(
            (attachment) => attachment.status === PortalAttachmentStatus.ACTIVE,
          )
          .map((attachment) => ({
            id: attachment.id,
            document_type: attachment.document_type,
            original_file_name: attachment.original_file_name,
            mime_type: attachment.mime_type,
            file_size: attachment.file_size,
            checksum: attachment.checksum,
            uploaded_by: attachment.uploaded_by,
            created_at: attachment.created_at,
          })) ?? [],
      events:
        request.events?.map((event) => ({
          id: event.id,
          old_status: event.old_status,
          new_status: event.new_status,
          message: event.message,
          changed_by: event.changed_by,
          metadata: event.metadata,
          created_at: event.created_at,
        })) ?? [],
    };
  }

  private pagination(query: PortalRequestFilterDto) {
    return {
      page: Math.max(1, Number(query.page ?? 1)),
      limit: Math.min(100, Math.max(1, Number(query.limit ?? 20))),
    };
  }

  private paginationMeta(page: number, limit: number, total: number) {
    return {
      page,
      limit,
      total,
      total_pages: total > 0 ? Math.ceil(total / limit) : 0,
    };
  }
}
