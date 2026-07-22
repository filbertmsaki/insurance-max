import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';

import { Branch } from '../branches/entities/branch.entity';
import { Policy } from '../policies/entities/policy.entity';
import { Quotation } from '../quotations/entities/quotation.entity';
import { TiramisSalePointEntity } from '../../tiramis/entities/tiramis-sale-point.entity';
import { TiramisSubmissionStatus } from '../../tiramis/enums/tiramis-submission-status.enum';
import { TiramisSubmissionTrackingEntity } from '../../tiramis/entities/tiramis-submission-tracking.entity';
import { TiramisSubmissionTrackingRepository } from '../../tiramis/repositories/tiramis-submission-tracking.repository';
import { TiramisBusinessRecordSyncService } from '../../tiramis/services/tiramis-business-record-sync.service';
import { FilterPortalTiraSubmissionDto } from './dto/filter-portal-tira-submission.dto';
import { TiramisNotificationEventDto } from './dto/tiramis-notification-event.dto';
import { SubmitPortalTiraDto } from './dto/submit-portal-tira.dto';
import { PortalTiraSubmissionEvent } from './entities/portal-tira-submission-event.entity';
import { PortalTiraSubmission } from './entities/portal-tira-submission.entity';
import { PortalTiraSubmissionStatus } from './enums/portal-tira-submission-status.enum';
import { TiramisClientService } from './tiramis-client.service';

const ZERO_UUID = '00000000-0000-0000-0000-000000000000';

@Injectable()
export class TiramisIntegrationService {
  private readonly logger = new Logger(TiramisIntegrationService.name);

  constructor(
    @InjectRepository(PortalTiraSubmission)
    private readonly submissionRepository: Repository<PortalTiraSubmission>,
    @InjectRepository(PortalTiraSubmissionEvent)
    private readonly eventRepository: Repository<PortalTiraSubmissionEvent>,
    @InjectRepository(Policy)
    private readonly policyRepository: Repository<Policy>,
    @InjectRepository(Quotation)
    private readonly quotationRepository: Repository<Quotation>,
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    @InjectRepository(TiramisSalePointEntity)
    private readonly salePointRepository: Repository<TiramisSalePointEntity>,
    private readonly tiramisClientService: TiramisClientService,
    private readonly localTrackingRepository: TiramisSubmissionTrackingRepository,
    private readonly tiramisBusinessRecordSyncService: TiramisBusinessRecordSyncService,
  ) {}

  async submitToTiramis(params: {
    companyId: string;
    userId?: string | null;
    dto: SubmitPortalTiraDto;
  }) {
    const dto = params.dto;
    const resolvedPayload = await this.resolveSubmissionPayload({
      companyId: params.companyId,
      dto,
    });

    const existing = await this.submissionRepository.findOne({
      where: {
        company_id: params.companyId,
        business_reference: dto.business_reference,
      },
    });

    if (
      existing &&
      ![
        PortalTiraSubmissionStatus.DRAFT,
        PortalTiraSubmissionStatus.FAILED,
        PortalTiraSubmissionStatus.ACK_FAILED,
        PortalTiraSubmissionStatus.FINAL_FAILED,
        PortalTiraSubmissionStatus.CALLBACK_REJECTED,
      ].includes(existing.status)
    ) {
      throw new BadRequestException(
        `TIRAMIS submission already exists for business reference ${dto.business_reference} with status ${existing.status}`,
      );
    }

    const sourceRecordId =
      dto.source_record_id || dto.policy_id || dto.quotation_id || null;

    const submission =
      existing ||
      this.submissionRepository.create({
        company_id: params.companyId,
        policy_id: dto.policy_id || null,
        quotation_id: dto.quotation_id || null,
        source_module: dto.source_module || null,
        source_record_id: sourceRecordId,
        business_reference: dto.business_reference,
        request_type: dto.requestType,
        status: PortalTiraSubmissionStatus.SUBMITTED_TO_TIRAMIS,
        submitted_at: new Date(),
        last_event_at: new Date(),
        last_payload: resolvedPayload,
      });

    submission.request_type = dto.requestType;
    submission.status = PortalTiraSubmissionStatus.SUBMITTED_TO_TIRAMIS;
    submission.last_error = null;
    submission.last_payload = resolvedPayload;
    submission.submitted_at = submission.submitted_at || new Date();
    submission.last_event_at = new Date();

    const savedSubmission = await this.submissionRepository.save(submission);

    await this.createEvent(savedSubmission, {
      eventType: 'PORTAL_SUBMITTED_TO_TIRAMIS',
      sourceService: 'insurance-portal-service',
      sourceCompanyId: params.companyId,
      sourceModule: dto.source_module || null,
      sourceRecordId,
      businessReference: dto.business_reference,
      tiramisTransactionId: savedSubmission.tiramis_transaction_id,
      requestId: savedSubmission.tiramis_request_id || 'PENDING',
      serviceType: dto.requestType,
      statusCode: null,
      statusDescription: 'Portal submitted request to TIRAMIS service',
      errorMessage: null,
      occurredAt: new Date().toISOString(),
    });

    try {
      const tiramisResponse = await this.tiramisClientService.submit({
        companyId: params.companyId,
        userId: params.userId,
        dto: {
          ...dto,
          payload: resolvedPayload,
        },
      });

      const normalized = this.normalizeTiramisSubmitResponse(tiramisResponse);

      savedSubmission.tiramis_transaction_id =
        normalized.tiramisTransactionId ||
        savedSubmission.tiramis_transaction_id;
      savedSubmission.tiramis_request_id =
        normalized.requestId || savedSubmission.tiramis_request_id;
      savedSubmission.service_type =
        normalized.serviceType || savedSubmission.service_type;
      savedSubmission.root_element =
        normalized.rootElement || savedSubmission.root_element;
      savedSubmission.status =
        normalized.acknowledgementStatusCode === 'TIRA001'
          ? PortalTiraSubmissionStatus.ACK_SUCCESS
          : PortalTiraSubmissionStatus.SENT_TO_TIRA;
      savedSubmission.status_code =
        normalized.acknowledgementStatusCode || savedSubmission.status_code;
      savedSubmission.status_description =
        normalized.acknowledgementStatusDesc || 'Submitted to TIRAMIS service';
      savedSubmission.last_event_at = new Date();

      const updatedSubmission =
        await this.submissionRepository.save(savedSubmission);

      await this.createEvent(updatedSubmission, {
        eventType: 'TIRAMIS_SUBMIT_RESPONSE',
        sourceService: 'tiramis-service',
        sourceCompanyId: params.companyId,
        sourceModule: dto.source_module || null,
        sourceRecordId,
        businessReference: dto.business_reference,
        tiramisTransactionId: updatedSubmission.tiramis_transaction_id,
        requestId: updatedSubmission.tiramis_request_id || 'UNKNOWN',
        serviceType: updatedSubmission.service_type,
        rootElement: updatedSubmission.root_element,
        statusCode: updatedSubmission.status_code,
        statusDescription: updatedSubmission.status_description,
        errorMessage: null,
        occurredAt: new Date().toISOString(),
      });

      return {
        submission: updatedSubmission,
        tiramisResponse,
      };
    } catch (error: any) {
      savedSubmission.status = PortalTiraSubmissionStatus.FAILED;
      savedSubmission.last_error =
        error?.message || 'Failed to submit to TIRAMIS service';
      savedSubmission.last_event_at = new Date();

      const failedSubmission =
        await this.submissionRepository.save(savedSubmission);

      await this.createEvent(failedSubmission, {
        eventType: 'PORTAL_TIRAMIS_SUBMIT_FAILED',
        sourceService: 'insurance-portal-service',
        sourceCompanyId: params.companyId,
        sourceModule: dto.source_module || null,
        sourceRecordId,
        businessReference: dto.business_reference,
        tiramisTransactionId: failedSubmission.tiramis_transaction_id,
        requestId: failedSubmission.tiramis_request_id || 'FAILED',
        serviceType: dto.requestType,
        statusCode: null,
        statusDescription: 'Portal failed to submit request to TIRAMIS service',
        errorMessage: failedSubmission.last_error,
        occurredAt: new Date().toISOString(),
      });

      throw error;
    }
  }

  private async resolveSubmissionPayload(params: {
    companyId: string;
    dto: SubmitPortalTiraDto;
  }): Promise<Record<string, any>> {
    const linkedBranchId = await this.resolveLinkedBranchId(params);
    const requestedBranchId = params.dto.branch_id || linkedBranchId || null;

    if (requestedBranchId) {
      await this.assertBranchBelongsToCompany(
        params.companyId,
        requestedBranchId,
      );
    }

    const explicitSalePointCode = this.extractSalePointCodeFromPayload(
      params.dto.payload,
    );

    const salePoint = await this.resolveSalePoint({
      companyId: params.companyId,
      branchId: requestedBranchId,
      salePointId: params.dto.sale_point_id || null,
      explicitSalePointCode,
    });

    if (
      params.dto.sale_point_id &&
      explicitSalePointCode &&
      explicitSalePointCode !== salePoint.salePointCode
    ) {
      throw new BadRequestException(
        'sale_point_id does not match payload salePointCode',
      );
    }

    return {
      ...params.dto.payload,
      salePointCode: salePoint.salePointCode,
    };
  }

  private async resolveLinkedBranchId(params: {
    companyId: string;
    dto: SubmitPortalTiraDto;
  }): Promise<string | null> {
    if (params.dto.policy_id) {
      const policy = await this.policyRepository.findOne({
        where: {
          id: params.dto.policy_id,
          company_id: params.companyId,
        },
        select: {
          branch_id: true,
          id: true,
        },
      });

      return policy?.branch_id || null;
    }

    if (params.dto.quotation_id) {
      const quotation = await this.quotationRepository.findOne({
        where: {
          id: params.dto.quotation_id,
          company_id: params.companyId,
        },
        select: {
          branch_id: true,
          id: true,
        },
      });

      return quotation?.branch_id || null;
    }

    if (
      params.dto.source_module?.toLowerCase().includes('policy') &&
      params.dto.source_record_id
    ) {
      const policy = await this.policyRepository.findOne({
        where: {
          id: params.dto.source_record_id,
          company_id: params.companyId,
        },
        select: {
          branch_id: true,
          id: true,
        },
      });

      return policy?.branch_id || null;
    }

    if (
      params.dto.source_module?.toLowerCase().includes('quotation') &&
      params.dto.source_record_id
    ) {
      const quotation = await this.quotationRepository.findOne({
        where: {
          id: params.dto.source_record_id,
          company_id: params.companyId,
        },
        select: {
          branch_id: true,
          id: true,
        },
      });

      return quotation?.branch_id || null;
    }

    return null;
  }

  private extractSalePointCodeFromPayload(
    payload: Record<string, any>,
  ): string | null {
    const value =
      payload?.salePointCode ||
      payload?.sale_point_code ||
      payload?.branchSalePointCode ||
      payload?.branch_sale_point_code ||
      null;

    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private async assertBranchBelongsToCompany(
    companyId: string,
    branchId: string,
  ): Promise<void> {
    const branch = await this.branchRepository.findOne({
      where: {
        id: branchId,
        company_id: companyId,
      },
      select: {
        id: true,
      },
    });

    if (!branch) {
      throw new BadRequestException('Invalid branch for current company');
    }
  }

  private async resolveSalePoint(params: {
    companyId: string;
    branchId: string | null;
    salePointId: string | null;
    explicitSalePointCode: string | null;
  }): Promise<TiramisSalePointEntity> {
    if (params.salePointId) {
      const salePoint = await this.salePointRepository.findOne({
        where: {
          id: params.salePointId,
          companyId: params.companyId,
          isActive: true,
        },
      });

      if (!salePoint) {
        throw new BadRequestException('Invalid or inactive TIRA sale point');
      }

      if (params.branchId && salePoint.branchId !== params.branchId) {
        throw new BadRequestException(
          'Selected sale point does not belong to the selected branch',
        );
      }

      return salePoint;
    }

    if (params.explicitSalePointCode) {
      const salePoint = await this.salePointRepository.findOne({
        where: {
          companyId: params.companyId,
          salePointCode: params.explicitSalePointCode,
          isActive: true,
        },
      });

      if (!salePoint) {
        throw new BadRequestException('Invalid or inactive TIRA sale point');
      }

      if (params.branchId && salePoint.branchId !== params.branchId) {
        throw new BadRequestException(
          'Selected sale point does not belong to the selected branch',
        );
      }

      return salePoint;
    }

    const where = params.branchId
      ? {
          companyId: params.companyId,
          branchId: params.branchId,
          isActive: true,
        }
      : {
          companyId: params.companyId,
          isActive: true,
        };

    const salePoints = await this.salePointRepository.find({
      where,
      order: {
        isDefault: 'DESC',
        createdAt: 'ASC',
      },
    });

    if (salePoints.length === 0) {
      throw new BadRequestException(
        params.branchId
          ? 'No active TIRA sale points configured for the selected branch'
          : 'No active TIRA sale points configured for this company',
      );
    }

    if (salePoints.length === 1) {
      return salePoints[0];
    }

    const defaultSalePoints = salePoints.filter(
      (salePoint) => salePoint.isDefault,
    );

    if (defaultSalePoints.length === 1) {
      return defaultSalePoints[0];
    }

    throw new BadRequestException(
      params.branchId
        ? 'Selected branch has multiple active TIRA sale points. Provide sale_point_id explicitly.'
        : 'Company has multiple active TIRA sale points. Provide branch_id or sale_point_id explicitly.',
    );
  }

  async handleTiramisNotification(payload: TiramisNotificationEventDto) {
    this.logger.log(
      `Handling TIRAMIS notification for requestId ${payload.requestId} (${payload.eventType})`,
    );

    const submission = await this.findOrCreateSubmissionFromEvent(payload);
    const nextStatus = this.mapEventToPortalStatus(payload);

    submission.status = nextStatus;
    submission.status_code = payload.statusCode || submission.status_code;
    submission.status_description =
      payload.statusDescription || submission.status_description;
    submission.tiramis_transaction_id =
      payload.tiramisTransactionId || submission.tiramis_transaction_id;
    submission.tiramis_request_id =
      payload.requestId || submission.tiramis_request_id;
    submission.tiramis_response_id =
      payload.responseId || submission.tiramis_response_id;
    submission.service_type = payload.serviceType || submission.service_type;
    submission.root_element = payload.rootElement || submission.root_element;
    submission.cover_note_reference_number =
      payload.coverNoteReferenceNumber ||
      submission.cover_note_reference_number;
    submission.policy_reference_number =
      payload.policyReferenceNumber || submission.policy_reference_number;
    submission.sticker_number =
      payload.stickerNumber || submission.sticker_number;
    submission.last_error = payload.errorMessage || null;
    submission.last_payload = payload as any;
    submission.last_event_at = payload.occurredAt
      ? new Date(payload.occurredAt)
      : new Date();

    if (this.isTerminalStatus(nextStatus)) {
      submission.completed_at = new Date();
    }

    const savedSubmission = await this.submissionRepository.save(submission);

    const updatedTracking =
      await this.syncLocalTrackingFromNotification(payload);

    await this.createEvent(savedSubmission, payload);
    await this.updateLinkedPolicy(savedSubmission, payload);

    if (updatedTracking) {
      await this.tiramisBusinessRecordSyncService.syncFromTracking(
        updatedTracking,
      );
    }

    return savedSubmission;
  }

  async findAll(companyId: string, query: FilterPortalTiraSubmissionDto) {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 20);
    const skip = (page - 1) * limit;

    const qb = this.submissionRepository
      .createQueryBuilder('submission')
      .where('submission.company_id = :companyId', { companyId })
      .orderBy('submission.created_at', 'DESC')
      .skip(skip)
      .take(limit);

    if (query.status) {
      qb.andWhere('submission.status = :status', { status: query.status });
    }

    if (query.policy_id) {
      qb.andWhere('submission.policy_id = :policyId', {
        policyId: query.policy_id,
      });
    }

    if (query.quotation_id) {
      qb.andWhere('submission.quotation_id = :quotationId', {
        quotationId: query.quotation_id,
      });
    }

    if (query.request_id) {
      qb.andWhere('submission.tiramis_request_id = :requestId', {
        requestId: query.request_id,
      });
    }

    if (query.business_reference) {
      qb.andWhere('submission.business_reference = :businessReference', {
        businessReference: query.business_reference,
      });
    }

    if (query.search) {
      const search = `%${query.search}%`;

      qb.andWhere(
        new Brackets((builder) => {
          builder
            .where('submission.business_reference ILIKE :search', { search })
            .orWhere('submission.tiramis_request_id ILIKE :search', {
              search,
            })
            .orWhere('submission.tiramis_response_id ILIKE :search', {
              search,
            })
            .orWhere('submission.cover_note_reference_number ILIKE :search', {
              search,
            })
            .orWhere('submission.sticker_number ILIKE :search', { search });
        }),
      );
    }

    const [items, total] = await qb.getManyAndCount();

    return {
      items,
      meta: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async findSalePoints(companyId: string, branchId?: string) {
    if (branchId) {
      await this.assertBranchBelongsToCompany(companyId, branchId);
    }

    const salePoints = await this.salePointRepository.find({
      where: branchId
        ? {
            companyId,
            branchId,
            isActive: true,
          }
        : {
            companyId,
            isActive: true,
          },
      order: {
        branchName: 'ASC',
        isDefault: 'DESC',
        salePointName: 'ASC',
        createdAt: 'ASC',
      },
    });

    return salePoints.map((salePoint) => ({
      id: salePoint.id,
      branchId: salePoint.branchId,
      branchCode: salePoint.branchCode,
      branchName: salePoint.branchName,
      salePointCode: salePoint.salePointCode,
      salePointName: salePoint.salePointName,
      isDefault: salePoint.isDefault,
      isActive: salePoint.isActive,
    }));
  }

  async findOne(companyId: string, id: string) {
    const submission = await this.submissionRepository.findOne({
      where: {
        id,
        company_id: companyId,
      },
      relations: {
        events: true,
        company: true,
        policy: true,
        quotation: true,
      },
    });

    if (!submission) {
      throw new NotFoundException('TIRAMIS submission not found');
    }

    return submission;
  }

  async findByRequestId(companyId: string, requestId: string) {
    const submission = await this.submissionRepository.findOne({
      where: {
        company_id: companyId,
        tiramis_request_id: requestId,
      },
      relations: {
        events: true,
        company: true,
        policy: true,
        quotation: true,
      },
    });

    if (!submission) {
      throw new NotFoundException('TIRAMIS submission not found');
    }

    return submission;
  }

  private async findOrCreateSubmissionFromEvent(
    payload: TiramisNotificationEventDto,
  ): Promise<PortalTiraSubmission> {
    const existing = await this.findExistingSubmission(payload);

    if (existing) {
      return existing;
    }

    const companyId = await this.resolveCompanyId(payload);
    const sourceModule = payload.sourceModule || payload.sourceService || null;
    const sourceRecordId = payload.sourceRecordId || null;
    const isPolicySource = this.isPolicySource(sourceModule);
    const isQuotationSource = this.isQuotationSource(sourceModule);

    const submission = this.submissionRepository.create({
      company_id: companyId,
      policy_id: isPolicySource && sourceRecordId ? sourceRecordId : null,
      quotation_id: isQuotationSource && sourceRecordId ? sourceRecordId : null,
      source_module: sourceModule,
      source_record_id: sourceRecordId,
      business_reference: payload.businessReference || null,
      request_type: null,
      service_type: payload.serviceType || null,
      root_element: payload.rootElement || null,
      tiramis_transaction_id: payload.tiramisTransactionId || null,
      tiramis_request_id: payload.requestId,
      tiramis_response_id: payload.responseId || null,
      status: this.mapEventToPortalStatus(payload),
      status_code: payload.statusCode || null,
      status_description: payload.statusDescription || null,
      cover_note_reference_number: payload.coverNoteReferenceNumber || null,
      policy_reference_number: payload.policyReferenceNumber || null,
      sticker_number: payload.stickerNumber || null,
      last_error: payload.errorMessage || null,
      last_payload: payload as any,
      submitted_at: new Date(payload.occurredAt || Date.now()),
      last_event_at: new Date(payload.occurredAt || Date.now()),
      completed_at: this.isTerminalStatus(this.mapEventToPortalStatus(payload))
        ? new Date(payload.occurredAt || Date.now())
        : null,
    });

    return this.submissionRepository.save(submission);
  }

  private async findExistingSubmission(
    payload: TiramisNotificationEventDto,
  ): Promise<PortalTiraSubmission | null> {
    if (payload.tiramisTransactionId) {
      const byTransaction = await this.submissionRepository.findOne({
        where: {
          tiramis_transaction_id: payload.tiramisTransactionId,
        },
      });

      if (byTransaction) {
        return byTransaction;
      }
    }

    if (payload.requestId) {
      const byRequest = await this.submissionRepository.findOne({
        where: {
          tiramis_request_id: payload.requestId,
        },
      });

      if (byRequest) {
        return byRequest;
      }
    }

    if (payload.businessReference && payload.sourceCompanyId) {
      const byBusinessReference = await this.submissionRepository.findOne({
        where: {
          company_id: payload.sourceCompanyId,
          business_reference: payload.businessReference,
        },
      });

      if (byBusinessReference) {
        return byBusinessReference;
      }
    }

    if (payload.sourceCompanyId && payload.sourceRecordId) {
      const bySource = await this.submissionRepository.findOne({
        where: {
          company_id: payload.sourceCompanyId,
          source_record_id: payload.sourceRecordId,
        },
      });

      if (bySource) {
        return bySource;
      }
    }

    return null;
  }

  private async syncLocalTrackingFromNotification(
    payload: TiramisNotificationEventDto,
  ): Promise<TiramisSubmissionTrackingEntity | null> {
    const tracking = await this.findMatchingLocalTracking(payload);

    if (!tracking) {
      return null;
    }

    const occurredAt = payload.occurredAt
      ? new Date(payload.occurredAt)
      : new Date();

    tracking.status = this.mapEventToLocalTrackingStatus(
      payload,
      tracking.status,
    );
    tracking.tiramisTransactionId =
      payload.tiramisTransactionId || tracking.tiramisTransactionId;
    tracking.tiramisRequestId = payload.requestId || tracking.tiramisRequestId;
    tracking.tiramisServiceType =
      payload.serviceType || tracking.tiramisServiceType;
    tracking.tiramisRootElement = payload.rootElement || tracking.tiramisRootElement;

    if (payload.eventType === 'TIRAMIS_ACK_RECEIVED') {
      tracking.acknowledgementStatusCode =
        payload.statusCode || tracking.acknowledgementStatusCode;
      tracking.acknowledgementStatusDesc =
        payload.statusDescription || tracking.acknowledgementStatusDesc;
      tracking.acknowledgedAt = tracking.acknowledgedAt || occurredAt;
    }

    if (
      payload.responseId ||
      payload.statusCode ||
      payload.eventType.startsWith('TIRAMIS_FINAL') ||
      payload.eventType === 'TIRAMIS_CALLBACK_REJECTED'
    ) {
      tracking.finalResponseId = payload.responseId || tracking.finalResponseId;
      tracking.finalResponseStatusCode =
        payload.statusCode || tracking.finalResponseStatusCode;
      tracking.finalResponseStatusDesc =
        payload.statusDescription || tracking.finalResponseStatusDesc;
      tracking.finalResponseReceivedAt =
        tracking.finalResponseReceivedAt || occurredAt;
      tracking.finalResponsePayload = payload as Record<string, any>;
    }

    tracking.lastErrorMessage =
      payload.errorMessage ||
      (tracking.status === TiramisSubmissionStatus.FINAL_SUCCESS
        ? null
        : tracking.lastErrorMessage);
    tracking.lastSyncedAt = occurredAt;
    tracking.syncAttempts = Number(tracking.syncAttempts || 0) + 1;

    if (
      tracking.status === TiramisSubmissionStatus.FINAL_FAILED ||
      tracking.status === TiramisSubmissionStatus.FAILED ||
      tracking.status === TiramisSubmissionStatus.CALLBACK_OVERDUE ||
      tracking.status === TiramisSubmissionStatus.ACK_FAILED
    ) {
      tracking.failedAt = tracking.failedAt || occurredAt;
    }

    if (tracking.status === TiramisSubmissionStatus.FINAL_SUCCESS) {
      tracking.failedAt = null;
      tracking.isRetryable = false;
      tracking.nextRetryAt = null;
      tracking.retryLockId = null;
      tracking.retryLockedAt = null;
      tracking.retryErrorMessage = null;
    }

    return this.localTrackingRepository.save(tracking);
  }

  private async findMatchingLocalTracking(
    payload: TiramisNotificationEventDto,
  ): Promise<TiramisSubmissionTrackingEntity | null> {
    if (payload.tiramisTransactionId) {
      const byTransaction = await this.localTrackingRepository.findByTransactionId(
        payload.tiramisTransactionId,
      );

      if (byTransaction) {
        return byTransaction;
      }
    }

    if (payload.requestId) {
      const byRequest = await this.localTrackingRepository.findByRequestId(
        payload.requestId,
      );

      if (byRequest) {
        return byRequest;
      }
    }

    if (payload.sourceRecordId) {
      const matches = await this.localTrackingRepository.findBySourceRecordId(
        payload.sourceRecordId,
      );

      if (matches.length > 0) {
        return matches[0];
      }
    }

    if (payload.businessReference) {
      const matches = await this.localTrackingRepository.findByBusinessReference(
        payload.businessReference,
      );

      if (matches.length > 0) {
        return matches[0];
      }
    }

    return null;
  }

  private async createEvent(
    submission: PortalTiraSubmission,
    payload: TiramisNotificationEventDto,
  ) {
    const event = this.eventRepository.create({
      submission_id: submission.id,
      company_id: submission.company_id,
      tiramis_transaction_id: payload.tiramisTransactionId || null,
      request_id: payload.requestId,
      response_id: payload.responseId || null,
      event_type: payload.eventType,
      status_code: payload.statusCode || null,
      status_description: payload.statusDescription || null,
      error_message: payload.errorMessage || null,
      payload: payload as any,
    });

    await this.eventRepository.save(event);
  }

  private async updateLinkedPolicy(
    submission: PortalTiraSubmission,
    payload: TiramisNotificationEventDto,
  ) {
    const policy = await this.findLinkedPolicy(submission, payload);

    if (!policy) {
      return;
    }

    policy.tira_status = submission.status;
    policy.tiramis_transaction_id =
      submission.tiramis_transaction_id || policy.tiramis_transaction_id;
    policy.tira_portal_transaction_id = submission.id;

    if (submission.cover_note_reference_number) {
      policy.cover_note_no = submission.cover_note_reference_number;
    }

    policy.metadata = {
      ...(policy.metadata || {}),
      tiramis: {
        requestId: submission.tiramis_request_id,
        responseId: submission.tiramis_response_id,
        status: submission.status,
        statusCode: submission.status_code,
        statusDescription: submission.status_description,
        coverNoteReferenceNumber: submission.cover_note_reference_number,
        policyReferenceNumber: submission.policy_reference_number,
        stickerNumber: submission.sticker_number,
        lastError: submission.last_error,
        lastEventAt: submission.last_event_at,
      },
    };

    await this.policyRepository.save(policy);
  }

  private async findLinkedPolicy(
    submission: PortalTiraSubmission,
    payload: TiramisNotificationEventDto,
  ) {
    if (submission.policy_id) {
      const policy = await this.policyRepository.findOne({
        where: {
          id: submission.policy_id,
          company_id: submission.company_id,
        },
      });

      if (policy) {
        return policy;
      }
    }

    if (payload.tiramisTransactionId) {
      const policy = await this.policyRepository.findOne({
        where: {
          tiramis_transaction_id: payload.tiramisTransactionId,
          company_id: submission.company_id,
        },
      });

      if (policy) {
        return policy;
      }
    }

    if (
      this.isPolicySource(submission.source_module) &&
      submission.source_record_id
    ) {
      const policy = await this.policyRepository.findOne({
        where: {
          id: submission.source_record_id,
          company_id: submission.company_id,
        },
      });

      if (policy) {
        return policy;
      }
    }

    return null;
  }

  private async resolveCompanyId(payload: TiramisNotificationEventDto) {
    if (payload.sourceCompanyId) {
      return payload.sourceCompanyId;
    }

    const sourceModule = payload.sourceModule || payload.sourceService || '';
    const sourceRecordId = payload.sourceRecordId || '';

    if (this.isPolicySource(sourceModule) && sourceRecordId) {
      const policy = await this.policyRepository.findOne({
        where: {
          id: sourceRecordId,
        },
      });

      if (policy) {
        return policy.company_id;
      }
    }

    if (this.isQuotationSource(sourceModule) && sourceRecordId) {
      const quotation = await this.quotationRepository.findOne({
        where: {
          id: sourceRecordId,
        },
      });

      if (quotation) {
        return quotation.company_id;
      }
    }

    return ZERO_UUID;
  }

  private normalizeTiramisSubmitResponse(response: any) {
    const coverNote = response?.coverNote || response?.data?.coverNote || null;
    const attempt = response?.attempt || response?.data?.attempt || null;
    const transaction =
      response?.transaction || response?.data?.transaction || null;

    return {
      tiramisTransactionId:
        transaction?.id ||
        coverNote?.transactionId ||
        attempt?.transactionId ||
        response?.tiramisTransactionId ||
        null,
      requestId:
        coverNote?.requestId ||
        attempt?.requestId ||
        response?.requestId ||
        null,
      serviceType: transaction?.serviceType || response?.serviceType || null,
      rootElement: attempt?.rootElement || response?.rootElement || null,
      acknowledgementStatusCode:
        attempt?.acknowledgementStatusCode ||
        response?.acknowledgementStatusCode ||
        null,
      acknowledgementStatusDesc:
        attempt?.acknowledgementStatusDesc ||
        response?.acknowledgementStatusDesc ||
        null,
    };
  }

  private isPolicySource(sourceModule?: string | null) {
    return Boolean(
      sourceModule && sourceModule.toLowerCase().includes('policy'),
    );
  }

  private isQuotationSource(sourceModule?: string | null) {
    return Boolean(
      sourceModule && sourceModule.toLowerCase().includes('quotation'),
    );
  }

  private mapEventToPortalStatus(
    payload: TiramisNotificationEventDto,
  ): PortalTiraSubmissionStatus {
    switch (payload.eventType) {
      case 'TIRAMIS_ACK_RECEIVED':
        return PortalTiraSubmissionStatus.ACK_SUCCESS;
      case 'TIRAMIS_ACK_FAILED':
        return PortalTiraSubmissionStatus.ACK_FAILED;
      case 'TIRAMIS_FINAL_RESPONSE_RECEIVED':
        return PortalTiraSubmissionStatus.WAITING_FINAL_RESPONSE;
      case 'TIRAMIS_FINAL_SUCCESS':
        return PortalTiraSubmissionStatus.COMPLETED;
      case 'TIRAMIS_FINAL_FAILED':
        return PortalTiraSubmissionStatus.FAILED;
      case 'TIRAMIS_FINAL_CALLBACK_OVERDUE':
        return PortalTiraSubmissionStatus.FINAL_CALLBACK_OVERDUE;
      case 'TIRAMIS_RESPONSE_ACK_SENT':
        return PortalTiraSubmissionStatus.COMPLETED;
      case 'TIRAMIS_CALLBACK_REJECTED':
        return PortalTiraSubmissionStatus.CALLBACK_REJECTED;
      case 'TIRAMIS_SUBMISSION_FAILED':
        return PortalTiraSubmissionStatus.FAILED;
      default:
        if (payload.transactionStatus === 'SUCCESS') {
          return PortalTiraSubmissionStatus.COMPLETED;
        }

        if (payload.transactionStatus === 'FAILED') {
          return PortalTiraSubmissionStatus.FAILED;
        }

        return PortalTiraSubmissionStatus.SUBMITTED_TO_TIRAMIS;
    }
  }

  private mapEventToLocalTrackingStatus(
    payload: TiramisNotificationEventDto,
    fallback: TiramisSubmissionStatus,
  ): TiramisSubmissionStatus {
    switch (payload.eventType) {
      case 'TIRAMIS_ACK_RECEIVED':
        return TiramisSubmissionStatus.ACK_ACCEPTED;
      case 'TIRAMIS_ACK_FAILED':
        return TiramisSubmissionStatus.ACK_FAILED;
      case 'TIRAMIS_FINAL_RESPONSE_RECEIVED':
        return TiramisSubmissionStatus.PENDING_FINAL;
      case 'TIRAMIS_FINAL_SUCCESS':
      case 'TIRAMIS_RESPONSE_ACK_SENT':
        return TiramisSubmissionStatus.FINAL_SUCCESS;
      case 'TIRAMIS_FINAL_FAILED':
        return TiramisSubmissionStatus.FINAL_FAILED;
      case 'TIRAMIS_FINAL_CALLBACK_OVERDUE':
        return TiramisSubmissionStatus.CALLBACK_OVERDUE;
      case 'TIRAMIS_CALLBACK_REJECTED':
      case 'TIRAMIS_SUBMISSION_FAILED':
        return TiramisSubmissionStatus.FAILED;
      default:
        if (payload.transactionStatus === 'SUCCESS') {
          return TiramisSubmissionStatus.FINAL_SUCCESS;
        }

        if (payload.transactionStatus === 'FAILED') {
          return TiramisSubmissionStatus.FINAL_FAILED;
        }

        return fallback;
    }
  }

  private isTerminalStatus(status: PortalTiraSubmissionStatus) {
    return [
      PortalTiraSubmissionStatus.ACK_FAILED,
      PortalTiraSubmissionStatus.COMPLETED,
      PortalTiraSubmissionStatus.FAILED,
      PortalTiraSubmissionStatus.CALLBACK_REJECTED,
    ].includes(status);
  }
}
