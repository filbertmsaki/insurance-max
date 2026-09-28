import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository } from 'typeorm';

import { Branch } from '../branches/entities/branch.entity';
import { IssuanceService } from '../issuance/issuance.service';
import { Policy } from '../policies/entities/policy.entity';
import { PolicyTransaction } from '../policy-transactions/entities/policy-transaction.entity';
import { PolicyTransactionApplyService } from '../policy-transactions/services/policy-transaction-apply.service';
import { PolicyTransactionLifecycleService } from '../policy-transactions/services/policy-transaction-lifecycle.service';
import { PolicyTransactionRegulatoryOutcomeService } from '../policy-transactions/services/policy-transaction-regulatory-outcome.service';
import { RenewalService } from '../policy-transactions/services/renewal.service';
import { PolicyStatusHistory } from '../policies/entities/policy-status-history.entity';
import { QuotationStatusHistory } from '../quotations/entities/quotation-status-history.entity';
import { Quotation } from '../quotations/entities/quotation.entity';
import { QuotationLifecycleService } from '../quotations/services/quotation-lifecycle.service';
import { TiramisSalePointEntity } from '../../tiramis/entities/tiramis-sale-point.entity';
import { TiramisSubmissionStatus } from '../../tiramis/enums/tiramis-submission-status.enum';
import { TiramisSubmissionTrackingEntity } from '../../tiramis/entities/tiramis-submission-tracking.entity';
import { TiramisSubmissionTrackingRepository } from '../../tiramis/repositories/tiramis-submission-tracking.repository';
import { TiramisBusinessRecordSyncService } from '../../tiramis/services/tiramis-business-record-sync.service';
import { IdentifierGeneratorService } from '../../shared/identifiers/identifier-generator.service';
import { NotificationPublisherService } from '../../shared/notifications/notification-publisher.service';
import { FilterPortalTiraSubmissionDto } from './dto/filter-portal-tira-submission.dto';
import { TiramisNotificationEventDto } from './dto/tiramis-notification-event.dto';
import { SubmitPortalTiraDto } from './dto/submit-portal-tira.dto';
import { PortalTiraSubmissionEvent } from './entities/portal-tira-submission-event.entity';
import { PortalTiraSubmission } from './entities/portal-tira-submission.entity';
import { PortalTiraSubmissionStatus } from './enums/portal-tira-submission-status.enum';
import { TiramisClientService } from './tiramis-client.service';
import { resolveTiramisSuccessOutcome } from './utils/tiramis-callback-outcome.util';

const ZERO_UUID = '00000000-0000-0000-0000-000000000000';
const POLICY_TERMINAL_STATUSES = new Set(['CANCELLED', 'EXPIRED', 'LAPSED']);

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
    @InjectRepository(PolicyStatusHistory)
    private readonly policyStatusHistoryRepository: Repository<PolicyStatusHistory>,
    @InjectRepository(Quotation)
    private readonly quotationRepository: Repository<Quotation>,
    @InjectRepository(QuotationStatusHistory)
    private readonly quotationStatusHistoryRepository: Repository<QuotationStatusHistory>,
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    @InjectRepository(TiramisSalePointEntity)
    private readonly salePointRepository: Repository<TiramisSalePointEntity>,
    @InjectRepository(PolicyTransaction)
    private readonly policyTransactionRepository: Repository<PolicyTransaction>,
    private readonly tiramisClientService: TiramisClientService,
    private readonly localTrackingRepository: TiramisSubmissionTrackingRepository,
    private readonly tiramisBusinessRecordSyncService: TiramisBusinessRecordSyncService,
    private readonly identifierGeneratorService: IdentifierGeneratorService,
    private readonly quotationLifecycleService: QuotationLifecycleService,
    private readonly issuanceService: IssuanceService,
    private readonly renewalService: RenewalService,
    private readonly policyTransactionLifecycleService: PolicyTransactionLifecycleService,
    private readonly policyTransactionApplyService: PolicyTransactionApplyService,
    private readonly policyTransactionRegulatoryOutcomeService: PolicyTransactionRegulatoryOutcomeService,
    private readonly notificationPublisher: NotificationPublisherService,
  ) {}

  async submitToTiramis(params: {
    companyId: string;
    userId?: string | null;
    dto: SubmitPortalTiraDto;
  }) {
    const dto = { ...params.dto };
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

    // Every outbound attempt has its own identity. Never reuse the request ID
    // (or the submission row) from a failed attempt: delayed callbacks must
    // remain attributable to the exact historical attempt that sent them.
    const requestId = await this.identifierGeneratorService.generateRequestId(
      params.companyId,
    );

    dto.requestId = requestId;

    const sourceRecordId =
      dto.source_record_id || dto.policy_id || dto.quotation_id || null;

    const submission = this.submissionRepository.create({
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
      tiramis_request_id: requestId,
    });

    submission.request_type = dto.requestType;
    submission.status = PortalTiraSubmissionStatus.SUBMITTED_TO_TIRAMIS;
    submission.last_error = null;
    submission.last_payload = resolvedPayload;
    submission.submitted_at = submission.submitted_at || new Date();
    submission.last_event_at = new Date();
    submission.tiramis_request_id = requestId;

    const savedSubmission = await this.submissionRepository.save(submission);

    await this.createEvent(savedSubmission, {
      eventType: 'PORTAL_SUBMITTED_TO_TIRAMIS',
      sourceService: 'insurance-portal-service',
      sourceCompanyId: params.companyId,
      sourceModule: dto.source_module || null,
      sourceRecordId,
      businessReference: dto.business_reference,
      tiramisTransactionId: savedSubmission.tiramis_transaction_id,
      requestId,
      serviceType: dto.requestType,
      statusCode: null,
      statusDescription: 'Portal submitted request to TIRAMIS service',
      requestPayload: resolvedPayload,
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
        normalized.requestId || savedSubmission.tiramis_request_id || requestId;
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
        requestId: updatedSubmission.tiramis_request_id || requestId,
        serviceType: updatedSubmission.service_type,
        rootElement: updatedSubmission.root_element,
        statusCode: updatedSubmission.status_code,
        statusDescription: updatedSubmission.status_description,
        responsePayload: tiramisResponse as Record<string, unknown>,
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
        requestId: failedSubmission.tiramis_request_id || requestId,
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
    const occurredAt = payload.occurredAt
      ? new Date(payload.occurredAt)
      : new Date();

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
      payload.regulatoryResponse?.coverNotes?.[0]?.coverNoteReferenceNumber ||
      submission.cover_note_reference_number;
    submission.policy_reference_number =
      payload.policyReferenceNumber ||
      payload.regulatoryResponse?.policy?.policyReferenceNumber ||
      submission.policy_reference_number;
    submission.sticker_number =
      payload.stickerNumber ||
      payload.regulatoryResponse?.coverNotes?.[0]?.stickerNumber ||
      submission.sticker_number;
    submission.last_error = payload.errorMessage || null;
    submission.last_payload = payload as any;
    submission.last_event_at = occurredAt;

    if (this.isTerminalStatus(nextStatus)) {
      submission.completed_at = submission.completed_at || occurredAt;
    }

    const savedSubmission = await this.submissionRepository.save(submission);

    const updatedTracking =
      await this.syncLocalTrackingFromNotification(payload);

    await this.createEvent(savedSubmission, payload);

    // IMPORTANT:
    // Update the quotation lifecycle first.
    //
    // Policy issuance is only allowed after the quotation itself has been
    // confirmed as COMPLETED + TIRAMIS SUCCESS.
    await this.updateLinkedQuotation(savedSubmission, payload);

    const issuanceResult = await this.issuanceService.applyNotification(
      savedSubmission,
      payload,
    );

    if (issuanceResult?.policy) {
      try {
        await this.renewalService.applyIssuedPolicyIfRenewal(
          issuanceResult.policy,
        );
      } catch (error) {
        this.logger.warn(
          `Failed to apply renewal linkage for policy ${issuanceResult.policy.id}: ${
            error instanceof Error ? error.message : error
          }`,
        );
      }
    }

    await this.updateLinkedPolicy(savedSubmission, payload);
    await this.updateLinkedPolicyTransaction(
      savedSubmission,
      payload,
      updatedTracking,
    );

    if (updatedTracking) {
      await this.tiramisBusinessRecordSyncService.syncFromTracking(
        updatedTracking,
      );
    }

    return savedSubmission;
  }

  async findAll(companyId: string, query: FilterPortalTiraSubmissionDto) {
    const sourceModule = query.source_module || query.sourceModule || null;

    if (this.isQuotationSource(sourceModule)) {
      return this.findQuotationTrackingSubmissions(companyId, query);
    }

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

    if (sourceModule) {
      qb.andWhere('submission.source_module = :sourceModule', {
        sourceModule,
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

    if (submission) {
      return submission;
    }

    const tracking = await this.localTrackingRepository.findById(id);

    if (tracking?.sourceCompanyId === companyId) {
      return this.mapTrackingToPortalSubmission(companyId, tracking);
    }

    throw new NotFoundException('TIRAMIS submission not found');
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

    if (submission) {
      return submission;
    }

    const tracking =
      await this.localTrackingRepository.findByRequestId(requestId);

    if (tracking?.sourceCompanyId === companyId) {
      return this.mapTrackingToPortalSubmission(companyId, tracking);
    }

    throw new NotFoundException('TIRAMIS submission not found');
  }

  private async findQuotationTrackingSubmissions(
    companyId: string,
    query: FilterPortalTiraSubmissionDto,
  ) {
    const submissions =
      await this.localTrackingRepository.findDashboardSubmissionsScoped(
        {
          page: query.page,
          limit: query.limit,
          search: query.search,
          status: query.status,
          sourceModule: 'quotations',
          businessReference: query.business_reference,
          tiramisRequestId: query.request_id,
        } as any,
        {
          companyId,
          canAccessAllCompanies: false,
        },
      );

    const items = await this.mapTrackingListToPortalSubmissions(
      companyId,
      submissions.items,
    );

    return {
      items,
      meta: {
        total: submissions.meta.total,
        page: submissions.meta.page,
        limit: submissions.meta.limit,
        pages: submissions.meta.totalPages,
      },
    };
  }

  private async mapTrackingListToPortalSubmissions(
    companyId: string,
    trackingItems: TiramisSubmissionTrackingEntity[],
  ) {
    const quotationIds = Array.from(
      new Set(
        trackingItems
          .map((item) => item.quotationId)
          .filter((value): value is string => !!value),
      ),
    );
    const policyIds = Array.from(
      new Set(
        trackingItems
          .map((item) => item.policyId)
          .filter((value): value is string => !!value),
      ),
    );

    const [quotations, policies] = await Promise.all([
      quotationIds.length
        ? this.quotationRepository.find({
            where: {
              company_id: companyId,
              id: In(quotationIds),
            },
          })
        : Promise.resolve([]),
      policyIds.length
        ? this.policyRepository.find({
            where: {
              company_id: companyId,
              id: In(policyIds),
            },
          })
        : Promise.resolve([]),
    ]);

    const quotationsById = new Map(quotations.map((item) => [item.id, item]));
    const policiesById = new Map(policies.map((item) => [item.id, item]));

    return trackingItems.map((item) =>
      this.mapTrackingToPortalSubmission(
        companyId,
        item,
        quotationsById.get(item.quotationId || ''),
        policiesById.get(item.policyId || ''),
      ),
    );
  }

  private mapTrackingToPortalSubmission(
    companyId: string,
    tracking: TiramisSubmissionTrackingEntity,
    quotation?: Quotation | null,
    policy?: Policy | null,
  ) {
    return {
      id: tracking.id,
      company_id: companyId,
      policy_id: tracking.policyId ?? null,
      quotation_id: tracking.quotationId ?? null,
      source_module: tracking.sourceModule ?? null,
      source_record_id: tracking.sourceRecordId ?? null,
      business_reference: tracking.businessReference ?? null,
      request_type: tracking.requestType ?? null,
      service_type: tracking.tiramisServiceType ?? null,
      root_element: tracking.tiramisRootElement ?? null,
      tiramis_transaction_id: tracking.tiramisTransactionId ?? null,
      tiramis_request_id: tracking.tiramisRequestId ?? null,
      tiramis_response_id: tracking.finalResponseId ?? null,
      status: tracking.status,
      status_code:
        tracking.finalResponseStatusCode ??
        tracking.acknowledgementStatusCode ??
        null,
      status_description:
        tracking.finalResponseStatusDesc ??
        tracking.acknowledgementStatusDesc ??
        tracking.lastErrorMessage ??
        null,
      cover_note_reference_number: this.readTrackingPayloadValue(tracking, [
        'coverNoteReferenceNumber',
        'cover_note_reference_number',
      ]),
      policy_reference_number: this.readTrackingPayloadValue(tracking, [
        'policyReferenceNumber',
        'policy_reference_number',
      ]),
      sticker_number: this.readTrackingPayloadValue(tracking, [
        'stickerNumber',
        'sticker_number',
      ]),
      last_error: tracking.lastErrorMessage ?? null,
      last_payload: tracking.requestPayload ?? null,
      submitted_at: tracking.submittedAt ?? null,
      last_event_at:
        tracking.finalResponseReceivedAt ??
        tracking.acknowledgedAt ??
        tracking.updatedAt,
      completed_at:
        tracking.finalResponseReceivedAt ?? tracking.failedAt ?? null,
      created_at: tracking.createdAt,
      updated_at: tracking.updatedAt,
      deleted_at: tracking.deletedAt ?? null,
      company: null,
      policy: policy ?? null,
      quotation: quotation ?? null,
      events: [],
    };
  }

  private readTrackingPayloadValue(
    tracking: TiramisSubmissionTrackingEntity,
    keys: string[],
  ) {
    const sources = [
      tracking.finalResponsePayload,
      tracking.tiramisResponsePayload,
      tracking.requestPayload,
    ];

    for (const source of sources) {
      if (!source || typeof source !== 'object') {
        continue;
      }

      for (const key of keys) {
        const value = (source as Record<string, unknown>)[key];

        if (typeof value === 'string' && value.trim()) {
          return value.trim();
        }
      }
    }

    return null;
  }

  private async findOrCreateSubmissionFromEvent(
    payload: TiramisNotificationEventDto,
  ): Promise<PortalTiraSubmission> {
    const existing = await this.findExistingSubmission(payload);

    if (existing) {
      return existing;
    }

    const matchingTracking = await this.findMatchingLocalTracking(payload);
    const companyId = await this.resolveCompanyId(payload, matchingTracking);
    const sourceModule = payload.sourceModule || payload.sourceService || null;
    const sourceRecordId = payload.sourceRecordId || null;
    const isPolicySource = this.isPolicySource(sourceModule);
    const isQuotationSource = this.isQuotationSource(sourceModule);

    let quotationId =
      isQuotationSource && sourceRecordId ? sourceRecordId : null;

    if (
      !quotationId &&
      !isPolicySource &&
      matchingTracking?.sourceModule === 'quotations' &&
      matchingTracking.sourceRecordId
    ) {
      quotationId = matchingTracking.sourceRecordId;
    }

    if (!quotationId && !isPolicySource && payload.businessReference) {
      const quotation = await this.findQuotationByBusinessReference(
        payload.businessReference,
        companyId,
      );
      quotationId = quotation?.id ?? null;
    }

    const submission = this.submissionRepository.create({
      company_id: companyId,
      policy_id: isPolicySource && sourceRecordId ? sourceRecordId : null,
      quotation_id: quotationId,
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
    // RequestId identifies the exact immutable attempt. It must take
    // precedence over the transaction/current quotation reference so a late
    // callback for an older attempt updates that older attempt's history.
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
    tracking.tiramisRootElement =
      payload.rootElement || tracking.tiramisRootElement;

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
    if (payload.requestId) {
      const byRequest = await this.localTrackingRepository.findByRequestId(
        payload.requestId,
      );

      if (byRequest) {
        return byRequest;
      }
    }

    if (payload.tiramisTransactionId) {
      const byTransaction =
        await this.localTrackingRepository.findByTransactionId(
          payload.tiramisTransactionId,
        );

      if (byTransaction) {
        return byTransaction;
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
      const matches =
        await this.localTrackingRepository.findByBusinessReference(
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
    // A cancellation or endorsement applies the policy and its new version
    // together after final acceptance; this generic status updater must not
    // change the source policy before that transaction succeeds.
    if (submission.source_module === 'policy-transactions') {
      return;
    }

    const policy = await this.findLinkedPolicy(submission, payload);

    if (!policy) {
      return;
    }

    const callbackOutcome = resolveTiramisSuccessOutcome({
      statusCode: payload.statusCode ?? submission.status_code,
      statusDescription:
        payload.statusDescription ?? submission.status_description,
    });
    const occurredAt = payload.occurredAt
      ? new Date(payload.occurredAt)
      : new Date();
    const originalPolicyStatus = policy.policy_status;

    policy.tira_status =
      callbackOutcome === 'CANCELLED' ? 'CANCELLED' : submission.status;
    policy.tiramis_transaction_id =
      submission.tiramis_transaction_id || policy.tiramis_transaction_id;
    policy.tira_portal_transaction_id = submission.id;
    policy.tiramis_status =
      callbackOutcome === 'CANCELLED' ? 'CANCELLED' : submission.status;
    policy.tiramis_request_id =
      submission.tiramis_request_id || policy.tiramis_request_id;
    policy.tiramis_service_type =
      submission.service_type || policy.tiramis_service_type;
    policy.tiramis_root_element =
      submission.root_element || policy.tiramis_root_element;
    policy.tiramis_final_response_id =
      submission.tiramis_response_id || policy.tiramis_final_response_id;
    policy.tiramis_final_response_status_code =
      submission.status_code || policy.tiramis_final_response_status_code;
    policy.tiramis_final_response_status_desc =
      submission.status_description ||
      policy.tiramis_final_response_status_desc;
    policy.tiramis_last_error_message =
      submission.last_error || policy.tiramis_last_error_message;
    policy.tiramis_last_synced_at = occurredAt;
    policy.tiramis_payload = payload as unknown as Record<string, unknown>;

    if (submission.cover_note_reference_number) {
      policy.cover_note_no = submission.cover_note_reference_number;
    }

    if (
      callbackOutcome === 'CANCELLED' &&
      !POLICY_TERMINAL_STATUSES.has(
        String(policy.policy_status || '')
          .trim()
          .toUpperCase(),
      )
    ) {
      policy.policy_status = 'CANCELLED';
    }

    policy.metadata = {
      ...(policy.metadata || {}),
      tiramis: {
        requestId: submission.tiramis_request_id,
        responseId: submission.tiramis_response_id,
        status:
          callbackOutcome === 'CANCELLED' ? 'CANCELLED' : submission.status,
        statusCode: submission.status_code,
        statusDescription: submission.status_description,
        coverNoteReferenceNumber: submission.cover_note_reference_number,
        policyReferenceNumber: submission.policy_reference_number,
        stickerNumber: submission.sticker_number,
        lastError: submission.last_error,
        lastEventAt: submission.last_event_at,
        callbackTimestamp: occurredAt.toISOString(),
        callbackOutcome,
        payload,
      },
    };

    await this.policyRepository.save(policy);

    if (
      policy.policy_status !== originalPolicyStatus &&
      policy.policy_status === 'CANCELLED'
    ) {
      await this.policyStatusHistoryRepository.save({
        policy_id: policy.id,
        old_status: originalPolicyStatus,
        new_status: policy.policy_status,
        reason:
          submission.status_description || payload.statusDescription || null,
        changed_by: null,
      });
    }
  }

  private async updateLinkedQuotation(
    submission: PortalTiraSubmission,
    payload: TiramisNotificationEventDto,
  ) {
    // Policy-transaction (endorsement/cancellation/renewal) submissions
    // must never drive the Quotation lifecycle — even if a Quotation
    // record ends up linked to one for audit purposes, applying quotation
    // completion semantics to it would risk it being treated as an
    // issuable new-business quotation elsewhere. Only
    // `updateLinkedPolicyTransaction()` may act on these submissions.
    if (submission.source_module === 'policy-transactions') {
      return;
    }

    const quotation = await this.findLinkedQuotation(submission, payload);

    if (!quotation) {
      return;
    }

    const callbackOutcome = resolveTiramisSuccessOutcome({
      statusCode: payload.statusCode ?? submission.status_code,
      statusDescription:
        payload.statusDescription ?? submission.status_description,
    });
    const callbackTimestamp =
      payload.occurredAt ??
      submission.last_event_at?.toISOString() ??
      new Date().toISOString();
    const context = {
      changedBy: null,
      changedByType: 'SYSTEM',
      source: 'TIRAMIS',
      reason:
        payload.statusDescription ||
        submission.status_description ||
        payload.errorMessage ||
        null,
      requestId: payload.requestId,
      tiraRequestId: payload.requestId,
      tiraResponseId: payload.responseId ?? null,
      metadata: {
        eventType: payload.eventType,
        transactionStatus: payload.transactionStatus ?? null,
        statusCode: payload.statusCode ?? null,
        statusDescription:
          payload.statusDescription ?? submission.status_description ?? null,
        errorMessage: payload.errorMessage ?? null,
        submissionStatus: submission.status,
        callbackTimestamp,
        callbackOutcome,
        callbackPayload: payload,
      },
    };

    switch (payload.eventType) {
      case 'TIRAMIS_ACK_RECEIVED':
        if (payload.statusCode === 'TIRA001') {
          await this.quotationLifecycleService.markTiraAcknowledged(
            submission.company_id,
            quotation.id,
            context,
          );
          break;
        }
        await this.quotationLifecycleService.markTiraProcessing(
          submission.company_id,
          quotation.id,
          context,
        );
        break;
      case 'TIRAMIS_FINAL_RESPONSE_RECEIVED':
        await this.quotationLifecycleService.markTiraProcessing(
          submission.company_id,
          quotation.id,
          context,
        );
        break;
      case 'TIRAMIS_FINAL_SUCCESS':
      case 'TIRAMIS_RESPONSE_ACK_SENT':
        await this.applySuccessfulQuotationOutcome(
          submission,
          quotation.id,
          context,
          callbackOutcome,
        );
        break;
      case 'TIRAMIS_CALLBACK_REJECTED':
        await this.quotationLifecycleService.markTiraRejected(
          submission.company_id,
          quotation.id,
          context,
        );
        break;
      case 'TIRAMIS_ACK_FAILED':
      case 'TIRAMIS_FINAL_FAILED':
      case 'TIRAMIS_SUBMISSION_FAILED':
        await this.quotationLifecycleService.markTiraFailed(
          submission.company_id,
          quotation.id,
          context,
        );
        break;
      case 'TIRAMIS_FINAL_CALLBACK_OVERDUE':
        await this.quotationLifecycleService.markTiraAcknowledged(
          submission.company_id,
          quotation.id,
          context,
        );
        break;
      default:
        if (submission.status === PortalTiraSubmissionStatus.COMPLETED) {
          await this.applySuccessfulQuotationOutcome(
            submission,
            quotation.id,
            context,
            callbackOutcome,
          );
        } else if (
          [
            PortalTiraSubmissionStatus.FAILED,
            PortalTiraSubmissionStatus.ACK_FAILED,
            PortalTiraSubmissionStatus.FINAL_FAILED,
          ].includes(submission.status)
        ) {
          await this.quotationLifecycleService.markTiraFailed(
            submission.company_id,
            quotation.id,
            context,
          );
        }
        break;
    }

    this.notificationPublisher.publishQuotationTiramisUpdated({
      companyId: submission.company_id,
      quotationId: quotation.id,
      requestId: payload.requestId,
      eventType: payload.eventType,
      statusCode: payload.statusCode ?? null,
      statusDescription:
        payload.statusDescription ?? submission.status_description ?? null,
      coverNoteReferenceNumber: submission.cover_note_reference_number ?? null,
      policyReferenceNumber: submission.policy_reference_number ?? null,
      stickerNumber: submission.sticker_number ?? null,
      occurredAt: callbackTimestamp,
    });
  }

  private async updateLinkedPolicyTransaction(
    submission: PortalTiraSubmission,
    payload: TiramisNotificationEventDto,
    tracking: TiramisSubmissionTrackingEntity | null,
  ) {
    if (submission.source_module !== 'policy-transactions') {
      return;
    }

    const transactionId = submission.source_record_id;

    if (!transactionId) {
      return;
    }

    const transaction = await this.policyTransactionRepository.findOne({
      where: { id: transactionId, company_id: submission.company_id },
    });

    if (!transaction) {
      return;
    }

    const context = {
      changedBy: null,
      reason: payload.statusDescription ?? payload.errorMessage ?? null,
      tiraRequestId: payload.requestId,
      tiraResponseId: payload.responseId ?? null,
      // Dedupe key for PolicyTransactionEvent (source_event_id, event_type):
      // `submission.id` is a stable UUID for this specific submission
      // attempt, so a replayed callback for the same attempt + outcome
      // hits the unique constraint instead of appending a duplicate audit
      // row. A resubmission always creates a new PortalTiraSubmission
      // (new id), so legitimate retries are unaffected.
      requestId: submission.id,
    };

    switch (payload.eventType) {
      case 'TIRAMIS_FINAL_SUCCESS': {
        if (
          submission.status !== PortalTiraSubmissionStatus.COMPLETED ||
          payload.regulatoryResponse?.success !== true
        ) {
          await this.policyTransactionLifecycleService.markSubmissionFailed(
            submission.company_id,
            transaction.id,
            {
              ...context,
              reason:
                'Final TIRAMIS success event did not contain a valid successful regulatory response.',
            },
          );
          return;
        }

        const captured =
          await this.policyTransactionRegulatoryOutcomeService.captureFinalSuccess(
            submission.company_id,
            transaction.id,
            submission,
            payload,
            tracking,
          );

        await this.policyTransactionLifecycleService.markSubmissionAccepted(
          submission.company_id,
          transaction.id,
          context,
        );
        await this.applyAcceptedPolicyTransaction(
          submission.company_id,
          captured.transaction,
        );
        break;
      }
      case 'TIRAMIS_RESPONSE_ACK_SENT':
        break;
      case 'TIRAMIS_CALLBACK_REJECTED':
        await this.policyTransactionRegulatoryOutcomeService.captureFinalRejection(
          submission.company_id,
          transaction.id,
          payload,
        );
        await this.policyTransactionLifecycleService.markSubmissionRejected(
          submission.company_id,
          transaction.id,
          context,
        );
        break;
      case 'TIRAMIS_ACK_FAILED':
      case 'TIRAMIS_FINAL_FAILED':
      case 'TIRAMIS_FINAL_CALLBACK_OVERDUE':
      case 'TIRAMIS_SUBMISSION_FAILED':
        await this.policyTransactionLifecycleService.markSubmissionFailed(
          submission.company_id,
          transaction.id,
          context,
        );
        break;
      default:
        break;
    }
  }

  private async applyAcceptedPolicyTransaction(
    companyId: string,
    transaction: PolicyTransaction,
  ) {
    if (transaction.transaction_type === 'ENDORSEMENT') {
      await this.policyTransactionApplyService.applyEndorsement(
        companyId,
        transaction.id,
      );
    } else if (transaction.transaction_type === 'CANCELLATION') {
      await this.policyTransactionApplyService.applyCancellation(
        companyId,
        transaction.id,
      );
    }
  }
  private async applySuccessfulQuotationOutcome(
    submission: PortalTiraSubmission,
    quotationId: string,
    context: Parameters<QuotationLifecycleService['markTiraSuccessful']>[2],
    outcome: ReturnType<typeof resolveTiramisSuccessOutcome>,
  ) {
    if (outcome === 'CANCELLED') {
      await this.quotationLifecycleService.markTiraCancelled(
        submission.company_id,
        quotationId,
        context,
      );
      return;
    }

    if (outcome === 'OTHER_SUCCESS') {
      this.logger.warn(
        `Unexpected successful TIRAMIS response description for requestId ${submission.tiramis_request_id}: ${
          context?.metadata?.statusDescription || 'N/A'
        }`,
      );
    }

    await this.quotationLifecycleService.markTiraSuccessful(
      submission.company_id,
      quotationId,
      context,
    );
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

  private async findLinkedQuotation(
    submission: PortalTiraSubmission,
    payload: TiramisNotificationEventDto,
  ) {
    if (submission.quotation_id) {
      const quotation = await this.quotationRepository.findOne({
        where: {
          id: submission.quotation_id,
          company_id: submission.company_id,
        },
      });

      if (quotation) {
        return quotation;
      }
    }

    const sourceModule =
      submission.source_module || payload.sourceModule || payload.sourceService;
    const sourceRecordId =
      submission.source_record_id || payload.sourceRecordId || null;

    if (this.isQuotationSource(sourceModule) && sourceRecordId) {
      const quotation = await this.quotationRepository.findOne({
        where: {
          id: sourceRecordId,
          company_id: submission.company_id,
        },
      });

      if (quotation) {
        return quotation;
      }
    }

    const businessReference =
      submission.business_reference || payload.businessReference || null;

    if (!this.isPolicySource(sourceModule) && businessReference) {
      const quotation = await this.findQuotationByBusinessReference(
        businessReference,
        submission.company_id,
      );

      if (quotation) {
        return quotation;
      }
    }

    return null;
  }

  private async resolveCompanyId(
    payload: TiramisNotificationEventDto,
    matchingTracking?: TiramisSubmissionTrackingEntity | null,
  ) {
    if (payload.sourceCompanyId) {
      return payload.sourceCompanyId;
    }

    if (matchingTracking?.sourceCompanyId) {
      return matchingTracking.sourceCompanyId;
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

    if (!this.isPolicySource(sourceModule) && payload.businessReference) {
      const quotation = await this.findQuotationByBusinessReference(
        payload.businessReference,
      );

      if (quotation) {
        return quotation.company_id;
      }
    }

    return ZERO_UUID;
  }

  /**
   * Cover-note submissions tag sourceModule with the domain that submitted
   * them (e.g. "motor", "non_motor", "reinsurance"), not "quotation" — so
   * isQuotationSource() never matches for these. businessReference always
   * carries the quotation_no, which is the one link every such submission
   * reliably carries back from TIRAMIS.
   */
  private async findQuotationByBusinessReference(
    businessReference: string,
    companyId?: string | null,
  ): Promise<Quotation | null> {
    return this.quotationRepository.findOne({
      where: {
        quotation_no: businessReference,
        ...(companyId ? { company_id: companyId } : {}),
      },
    });
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
        response?.request?.requestId ||
        response?.requestId ||
        null,
      serviceType:
        transaction?.serviceType ||
        response?.serviceType ||
        response?.service ||
        null,
      rootElement: attempt?.rootElement || response?.rootElement || null,
      acknowledgementStatusCode:
        attempt?.acknowledgementStatusCode ||
        response?.tira?.statusCode ||
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
