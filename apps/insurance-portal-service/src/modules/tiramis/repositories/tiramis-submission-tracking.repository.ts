import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { SelectQueryBuilder, In, IsNull, Repository } from 'typeorm';

import { TiramisDashboardQueryDto } from '../dto/tiramis-dashboard-query.dto';
import { TiramisSubmissionTrackingEntity } from '../entities/tiramis-submission-tracking.entity';
import { TiramisSubmissionStatus } from '../enums/tiramis-submission-status.enum';

@Injectable()
export class TiramisSubmissionTrackingRepository {
  constructor(
    @InjectRepository(TiramisSubmissionTrackingEntity)
    private readonly repository: Repository<TiramisSubmissionTrackingEntity>,
  ) {}

  create(data: Partial<TiramisSubmissionTrackingEntity>) {
    return this.repository.create(data);
  }

  save(entity: TiramisSubmissionTrackingEntity) {
    return this.repository.save(entity);
  }

  findById(id: string) {
    return this.repository.findOne({
      where: { id },
    });
  }

  findByBusinessReference(businessReference: string) {
    return this.repository.find({
      where: { businessReference },
      order: { createdAt: 'DESC' },
    });
  }

  findBySourceRecordId(sourceRecordId: string) {
    return this.repository.find({
      where: { sourceRecordId },
      order: { createdAt: 'DESC' },
    });
  }

  findRecent(limit = 50) {
    return this.repository.find({
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async findDashboardSubmissions(query: TiramisDashboardQueryDto) {
    return this.findDashboardSubmissionsScoped(query);
  }

  async findDashboardSubmissionsScoped(
    query: TiramisDashboardQueryDto,
    scope?: {
      companyId?: string | null;
      canAccessAllCompanies?: boolean;
    },
  ) {
    const page = Math.max(Number(query.page || 1), 1);
    const limit = Math.min(Math.max(Number(query.limit || 20), 1), 100);
    const skip = (page - 1) * limit;

    const qb = this.repository
      .createQueryBuilder('tracking')
      .where('tracking.deleted_at IS NULL');

    this.applyDashboardFilters(qb, query, scope);

    qb.orderBy('tracking.created_at', 'DESC').skip(skip).take(limit);

    const [items, total] = await qb.getManyAndCount();

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  async getDashboardStatistics(query: TiramisDashboardQueryDto) {
    return this.getDashboardStatisticsScoped(query);
  }

  async getDashboardStatisticsScoped(
    query: TiramisDashboardQueryDto,
    scope?: {
      companyId?: string | null;
      canAccessAllCompanies?: boolean;
    },
  ) {
    const baseQb = this.repository
      .createQueryBuilder('tracking')
      .where('tracking.deleted_at IS NULL');

    this.applyDashboardFilters(baseQb, query, scope);

    const total = await baseQb.clone().getCount();

    const byStatus = await baseQb
      .clone()
      .select('tracking.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('tracking.status')
      .orderBy('COUNT(*)', 'DESC')
      .getRawMany();

    const byRequestType = await baseQb
      .clone()
      .select('tracking.request_type', 'requestType')
      .addSelect('COUNT(*)', 'count')
      .groupBy('tracking.request_type')
      .orderBy('COUNT(*)', 'DESC')
      .getRawMany();

    const bySourceModule = await baseQb
      .clone()
      .select('tracking.source_module', 'sourceModule')
      .addSelect('COUNT(*)', 'count')
      .groupBy('tracking.source_module')
      .orderBy('COUNT(*)', 'DESC')
      .getRawMany();

    const finalSuccess = await baseQb
      .clone()
      .andWhere('tracking.status = :status', {
        status: TiramisSubmissionStatus.FINAL_SUCCESS,
      })
      .getCount();

    const finalFailed = await baseQb
      .clone()
      .andWhere('tracking.status = :status', {
        status: TiramisSubmissionStatus.FINAL_FAILED,
      })
      .getCount();

    const retryPending = await baseQb
      .clone()
      .andWhere('tracking.status = :status', {
        status: TiramisSubmissionStatus.RETRY_PENDING,
      })
      .getCount();

    const retryExhausted = await baseQb
      .clone()
      .andWhere('tracking.status = :status', {
        status: TiramisSubmissionStatus.RETRY_EXHAUSTED,
      })
      .getCount();

    const acknowledged = await baseQb
      .clone()
      .andWhere('tracking.status = :status', {
        status: TiramisSubmissionStatus.ACKNOWLEDGED,
      })
      .getCount();

    const failed = await baseQb
      .clone()
      .andWhere('tracking.status = :status', {
        status: TiramisSubmissionStatus.FAILED,
      })
      .getCount();

    return {
      total,
      summary: {
        acknowledged,
        finalSuccess,
        finalFailed,
        failed,
        retryPending,
        retryExhausted,
        successRate:
          finalSuccess + finalFailed > 0
            ? Number(
                ((finalSuccess / (finalSuccess + finalFailed)) * 100).toFixed(
                  2,
                ),
              )
            : 0,
      },
      byStatus: byStatus.map((item) => ({
        status: item.status,
        count: Number(item.count),
      })),
      byRequestType: byRequestType.map((item) => ({
        requestType: item.requestType,
        count: Number(item.count),
      })),
      bySourceModule: bySourceModule.map((item) => ({
        sourceModule: item.sourceModule || 'UNKNOWN',
        count: Number(item.count),
      })),
    };
  }

  async findFailedSubmissions(limit = 50) {
    return this.findFailedSubmissionsScoped(limit);
  }

  async findFailedSubmissionsScoped(
    limit = 50,
    scope?: {
      companyId?: string | null;
      canAccessAllCompanies?: boolean;
    },
  ) {
    const where: any[] = [
      { status: TiramisSubmissionStatus.FAILED },
      { status: TiramisSubmissionStatus.FINAL_FAILED },
      { status: TiramisSubmissionStatus.RETRY_EXHAUSTED },
    ];

    if (scope?.companyId && !scope.canAccessAllCompanies) {
      where.forEach((item) => {
        item.sourceCompanyId = scope.companyId;
      });
    }

    return this.repository.find({
      where,
      order: { updatedAt: 'DESC' },
      take: limit,
    });
  }

  async findRetryableSubmissions(limit = 50) {
    return this.findRetryableSubmissionsScoped(limit);
  }

  async findRetryableSubmissionsScoped(
    limit = 50,
    scope?: {
      companyId?: string | null;
      canAccessAllCompanies?: boolean;
    },
  ) {
    const where: any = {
      isRetryable: true,
      status: TiramisSubmissionStatus.RETRY_PENDING,
    };

    if (scope?.companyId && !scope.canAccessAllCompanies) {
      where.sourceCompanyId = scope.companyId;
    }

    return this.repository.find({
      where,
      order: {
        nextRetryAt: 'ASC',
        updatedAt: 'ASC',
      },
      take: limit,
    });
  }

  findExistingActiveSubmission(params: {
    sourceCompanyId?: string | null;
    requestType: string;
    sourceModule?: string | null;
    sourceRecordId?: string | null;
    businessReference?: string | null;
    idempotencyKey?: string | null;
  }) {
    return this.repository.findOne({
      where: [
        {
          idempotencyKey: params.idempotencyKey || undefined,
          status: In([
            TiramisSubmissionStatus.PENDING,
            TiramisSubmissionStatus.SENT_TO_TIRAMIS_SERVICE,
            TiramisSubmissionStatus.ACKNOWLEDGED,
            TiramisSubmissionStatus.RETRY_PENDING,
            TiramisSubmissionStatus.RETRYING,
            TiramisSubmissionStatus.FINAL_SUCCESS,
          ]),
        },
        {
          sourceCompanyId: params.sourceCompanyId || undefined,
          requestType: params.requestType as any,
          sourceModule: params.sourceModule || undefined,
          sourceRecordId: params.sourceRecordId || undefined,
          businessReference: params.businessReference || undefined,
          status: In([
            TiramisSubmissionStatus.PENDING,
            TiramisSubmissionStatus.SENT_TO_TIRAMIS_SERVICE,
            TiramisSubmissionStatus.ACKNOWLEDGED,
            TiramisSubmissionStatus.RETRY_PENDING,
            TiramisSubmissionStatus.RETRYING,
            TiramisSubmissionStatus.FINAL_SUCCESS,
          ]),
        },
      ],
      order: {
        createdAt: 'DESC',
      },
    });
  }

  findLatestSubmissionForSameBusiness(params: {
    sourceCompanyId?: string | null;
    requestType: string;
    sourceModule?: string | null;
    sourceRecordId?: string | null;
    businessReference?: string | null;
  }) {
    return this.repository.findOne({
      where: {
        sourceCompanyId: params.sourceCompanyId || undefined,
        requestType: params.requestType as any,
        sourceModule: params.sourceModule || undefined,
        sourceRecordId: params.sourceRecordId || undefined,
        businessReference: params.businessReference || undefined,
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  findPendingFinalSync(limit = 50) {
    return this.repository.find({
      where: [
        {
          status: In([
            TiramisSubmissionStatus.SENT_TO_TIRAMIS_SERVICE,
            TiramisSubmissionStatus.ACKNOWLEDGED,
            TiramisSubmissionStatus.UNKNOWN,
          ]),
          finalResponseId: IsNull(),
        },
      ],
      order: {
        updatedAt: 'ASC',
      },
      take: limit,
    });
  }

  async markSent(id: string, response: any) {
    await this.repository.update(
      { id },
      {
        status: TiramisSubmissionStatus.SENT_TO_TIRAMIS_SERVICE,
        submittedAt: new Date(),
        tiramisTransactionId:
          response?.transaction?.id ||
          response?.transactionId ||
          response?.tiramisTransactionId ||
          null,
        tiramisRequestId:
          response?.requestId ||
          response?.reinsurance?.requestId ||
          response?.policy?.requestId ||
          response?.record?.requestId ||
          response?.coverNote?.requestId ||
          null,
        tiramisServiceType:
          response?.serviceType ||
          response?.transaction?.serviceType ||
          null,
        tiramisRootElement:
          response?.rootElement ||
          response?.tiraResponse?.rootElement ||
          null,
        tiramisResponsePayload: response || null,
      },
    );

    return this.findById(id);
  }

  async markAcknowledged(id: string, response: any) {
    await this.repository.update(
      { id },
      {
        status: TiramisSubmissionStatus.ACKNOWLEDGED,
        acknowledgedAt: new Date(),
        acknowledgementStatusCode:
          response?.acknowledgement?.statusCode ||
          response?.tiraResponse?.acknowledgementStatusCode ||
          response?.tiraResponse?.AcknowledgementStatusCode ||
          null,
        acknowledgementStatusDesc:
          response?.acknowledgement?.statusDesc ||
          response?.tiraResponse?.acknowledgementStatusDesc ||
          response?.tiraResponse?.AcknowledgementStatusDesc ||
          null,
        tiramisResponsePayload: response || null,
      },
    );

    return this.findById(id);
  }

  async markFailed(
    id: string,
    error: any,
    options?: {
      retryable?: boolean;
      maxRetryAttempts?: number;
    },
  ) {
    const retryable = !!options?.retryable;
    const maxRetryAttempts = options?.maxRetryAttempts || 5;

    await this.repository.update(
      { id },
      {
        status: retryable
          ? TiramisSubmissionStatus.RETRY_PENDING
          : TiramisSubmissionStatus.FAILED,
        isRetryable: retryable,
        maxRetryAttempts,
        nextRetryAt: retryable ? this.calculateNextRetryAt(0) : null,
        failedAt: new Date(),
        lastErrorMessage:
          error?.message ||
          error?.response?.message ||
          error?.error?.message ||
          'TIRAMIS submission failed',
        tiramisResponsePayload: {
          error: error?.response || error?.error || error?.message || error,
        },
      },
    );

    return this.findById(id);
  }

  async findRetryablePending(limit = 20) {
    return this.repository
      .createQueryBuilder('tracking')
      .where('tracking.is_retryable = :isRetryable', { isRetryable: true })
      .andWhere('tracking.status IN (:...statuses)', {
        statuses: [
          TiramisSubmissionStatus.RETRY_PENDING,
          TiramisSubmissionStatus.UNKNOWN,
        ],
      })
      .andWhere('tracking.retry_attempts < tracking.max_retry_attempts')
      .andWhere('(tracking.next_retry_at IS NULL OR tracking.next_retry_at <= now())')
      .andWhere('tracking.deleted_at IS NULL')
      .orderBy('tracking.next_retry_at', 'ASC', 'NULLS FIRST')
      .addOrderBy('tracking.created_at', 'ASC')
      .take(limit)
      .getMany();
  }

  async markRetrying(id: string, lockId: string) {
    await this.repository.update(
      { id },
      {
        status: TiramisSubmissionStatus.RETRYING,
        retryLockId: lockId,
        retryLockedAt: new Date(),
        lastRetryAt: new Date(),
      },
    );

    return this.findById(id);
  }

  async markRetrySuccess(id: string, response: any) {
    const tracking = await this.findById(id);

    await this.repository.update(
      { id },
      {
        status: TiramisSubmissionStatus.SENT_TO_TIRAMIS_SERVICE,
        isRetryable: false,
        retryLockId: null,
        retryLockedAt: null,
        lastErrorMessage: null,
        submittedAt: new Date(),
        retryAttempts: tracking?.retryAttempts || 0,
        tiramisTransactionId:
          response?.transaction?.id ||
          response?.transactionId ||
          response?.tiramisTransactionId ||
          tracking?.tiramisTransactionId ||
          null,
        tiramisRequestId:
          response?.requestId ||
          response?.reinsurance?.requestId ||
          response?.policy?.requestId ||
          response?.record?.requestId ||
          response?.coverNote?.requestId ||
          tracking?.tiramisRequestId ||
          null,
        tiramisServiceType:
          response?.serviceType ||
          response?.transaction?.serviceType ||
          tracking?.tiramisServiceType ||
          null,
        tiramisRootElement:
          response?.rootElement ||
          response?.tiraResponse?.rootElement ||
          tracking?.tiramisRootElement ||
          null,
        tiramisResponsePayload: response || tracking?.tiramisResponsePayload || null,
      },
    );

    return this.findById(id);
  }

  async markRetryFailed(id: string, error: any) {
    const tracking = await this.findById(id);

    const nextRetryAttempts = (tracking?.retryAttempts || 0) + 1;
    const maxRetryAttempts = tracking?.maxRetryAttempts || 5;
    const exhausted = nextRetryAttempts >= maxRetryAttempts;

    await this.repository.update(
      { id },
      {
        status: exhausted
          ? TiramisSubmissionStatus.RETRY_EXHAUSTED
          : TiramisSubmissionStatus.RETRY_PENDING,
        isRetryable: !exhausted,
        retryAttempts: nextRetryAttempts,
        nextRetryAt: exhausted
          ? null
          : this.calculateNextRetryAt(nextRetryAttempts),
        retryLockId: null,
        retryLockedAt: null,
        failedAt: new Date(),
        lastErrorMessage:
          error?.message ||
          error?.response?.message ||
          error?.error?.message ||
          'TIRAMIS retry failed',
        tiramisResponsePayload: {
          previous: tracking?.tiramisResponsePayload || null,
          retryError: error?.response || error?.error || error?.message || error,
        } as any,
      },
    );

    return this.findById(id);
  }

  async releaseStaleRetryLocks(minutes = 15) {
    await this.repository
      .createQueryBuilder()
      .update()
      .set({
        status: TiramisSubmissionStatus.RETRY_PENDING,
        retryLockId: null,
        retryLockedAt: null,
      })
      .where('status = :status', {
        status: TiramisSubmissionStatus.RETRYING,
      })
      .andWhere('retry_locked_at < now() - (:minutes * interval \'1 minute\')', {
        minutes,
      })
      .execute();
  }

  async markBusinessRecordSynced(id: string) {
    const tracking = await this.findById(id);

    await this.repository.update(
      { id },
      {
        businessRecordSyncedAt: new Date(),
        businessRecordSyncError: null,
        businessRecordSyncAttempts: (tracking?.businessRecordSyncAttempts || 0) + 1,
      },
    );

    return this.findById(id);
  }

  async markBusinessRecordSyncFailed(id: string, error: any) {
    const tracking = await this.findById(id);

    await this.repository.update(
      { id },
      {
        businessRecordSyncError:
          error?.message ||
          error?.response?.message ||
          error?.error?.message ||
          'Failed to sync TIRAMIS status to business record',
        businessRecordSyncAttempts: (tracking?.businessRecordSyncAttempts || 0) + 1,
      },
    );

    return this.findById(id);
  }

  async markSyncChecked(id: string, response: any) {
    const tracking = await this.findById(id);

    await this.repository.update(
      { id },
      {
        lastSyncedAt: new Date(),
        syncAttempts: (tracking?.syncAttempts || 0) + 1,
        tiramisResponsePayload: response || tracking?.tiramisResponsePayload || null,
      },
    );

    return this.findById(id);
  }

  async markFinalFromTiramisStatus(id: string, response: any) {
    const finalStatus = this.extractFinalStatus(response);

    if (!finalStatus?.responseId) {
      return this.markSyncChecked(id, response);
    }

    const isSuccess =
      finalStatus.statusCode === 'TIRA001' ||
      String(finalStatus.statusDesc || '').toLowerCase() === 'successful';

    await this.repository.update(
      { id },
      {
        status: isSuccess
          ? TiramisSubmissionStatus.FINAL_SUCCESS
          : TiramisSubmissionStatus.FINAL_FAILED,
        finalResponseId: finalStatus.responseId,
        finalResponseStatusCode: finalStatus.statusCode,
        finalResponseStatusDesc: finalStatus.statusDesc,
        finalResponseReceivedAt: finalStatus.receivedAt
          ? new Date(finalStatus.receivedAt)
          : new Date(),
        finalResponsePayload: finalStatus.payload || response || null,
        tiramisResponsePayload: response || null,
        lastSyncedAt: new Date(),
        lastErrorMessage: isSuccess
          ? null
          : finalStatus.statusDesc || 'TIRAMIS final response failed',
      },
    );

    return this.findById(id);
  }

  private extractFinalStatus(response: any): {
    responseId?: string | null;
    statusCode?: string | null;
    statusDesc?: string | null;
    receivedAt?: string | Date | null;
    payload?: Record<string, any> | null;
  } | null {
    const transaction =
      response?.transaction ||
      response?.data?.transaction ||
      response?.tiramis?.transaction ||
      null;

    const finalResponse =
      response?.finalResponse ||
      response?.data?.finalResponse ||
      response?.tiramis?.finalResponse ||
      response?.currentAttempt?.finalResponse ||
      response?.data?.currentAttempt?.finalResponse ||
      response?.tiramis?.currentAttempt?.finalResponse ||
      transaction?.finalResponse ||
      transaction?.latestFinalResponse ||
      null;

    const statusSource =
      finalResponse ||
      response?.summary ||
      response?.data?.summary ||
      response?.tiramis?.summary ||
      null;

    return {
      responseId:
        finalResponse?.responseId ||
        finalResponse?.ResponseId ||
        transaction?.finalResponseId ||
        transaction?.responseId ||
        response?.responseId ||
        null,
      statusCode:
        finalResponse?.responseStatusCode ||
        finalResponse?.ResponseStatusCode ||
        statusSource?.finalResponseStatusCode ||
        statusSource?.responseStatusCode ||
        transaction?.finalResponseStatusCode ||
        transaction?.responseStatusCode ||
        response?.responseStatusCode ||
        null,
      statusDesc:
        finalResponse?.responseStatusDesc ||
        finalResponse?.ResponseStatusDesc ||
        statusSource?.finalResponseStatusDesc ||
        statusSource?.responseStatusDesc ||
        transaction?.finalResponseStatusDesc ||
        transaction?.responseStatusDesc ||
        response?.responseStatusDesc ||
        null,
      receivedAt:
        finalResponse?.receivedAt ||
        statusSource?.finalResponseReceivedAt ||
        transaction?.finalResponseReceivedAt ||
        response?.finalResponseReceivedAt ||
        null,
      payload: finalResponse || response || null,
    };
  }

  private calculateNextRetryAt(retryAttempts: number) {
    const delayMinutes = Math.min(
      Math.pow(2, retryAttempts),
      Number(process.env.TIRAMIS_RETRY_MAX_DELAY_MINUTES || 30),
    );

    return new Date(Date.now() + delayMinutes * 60 * 1000);
  }

  private applyDashboardFilters(
    qb: SelectQueryBuilder<TiramisSubmissionTrackingEntity>,
    query: TiramisDashboardQueryDto,
    scope?: {
      companyId?: string | null;
      canAccessAllCompanies?: boolean;
    },
  ) {
    if (query.status) {
      qb.andWhere('tracking.status = :status', {
        status: query.status,
      });
    }

    if (query.requestType) {
      qb.andWhere('tracking.request_type = :requestType', {
        requestType: query.requestType,
      });
    }

    if (query.sourceModule) {
      qb.andWhere('tracking.source_module = :sourceModule', {
        sourceModule: query.sourceModule,
      });
    }

    if (query.sourceCompanyId) {
      qb.andWhere('tracking.source_company_id = :sourceCompanyId', {
        sourceCompanyId: query.sourceCompanyId,
      });
    } else if (scope?.companyId && !scope.canAccessAllCompanies) {
      qb.andWhere('tracking.source_company_id = :scopeCompanyId', {
        scopeCompanyId: scope.companyId,
      });
    }

    if (query.sourceRecordId) {
      qb.andWhere('tracking.source_record_id = :sourceRecordId', {
        sourceRecordId: query.sourceRecordId,
      });
    }

    if (query.businessReference) {
      qb.andWhere('tracking.business_reference = :businessReference', {
        businessReference: query.businessReference,
      });
    }

    if (query.tiramisRequestId) {
      qb.andWhere('tracking.tiramis_request_id = :tiramisRequestId', {
        tiramisRequestId: query.tiramisRequestId,
      });
    }

    if (query.tiramisTransactionId) {
      qb.andWhere('tracking.tiramis_transaction_id = :tiramisTransactionId', {
        tiramisTransactionId: query.tiramisTransactionId,
      });
    }

    if (query.finalResponseStatusCode) {
      qb.andWhere('tracking.final_response_status_code = :finalResponseStatusCode', {
        finalResponseStatusCode: query.finalResponseStatusCode,
      });
    }

    if (query.isRetryable !== undefined) {
      qb.andWhere('tracking.is_retryable = :isRetryable', {
        isRetryable: String(query.isRetryable).toLowerCase() === 'true',
      });
    }

    if (query.dateFrom) {
      qb.andWhere('tracking.created_at >= :dateFrom', {
        dateFrom: new Date(query.dateFrom),
      });
    }

    if (query.dateTo) {
      qb.andWhere('tracking.created_at <= :dateTo', {
        dateTo: new Date(query.dateTo),
      });
    }

    if (query.search) {
      qb.andWhere(
        `(
          tracking.business_reference ILIKE :search OR
          tracking.source_record_id ILIKE :search OR
          tracking.tiramis_request_id ILIKE :search OR
          tracking.last_error_message ILIKE :search
        )`,
        {
          search: `%${query.search}%`,
        },
      );
    }
  }
}
