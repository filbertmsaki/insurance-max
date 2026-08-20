import { environment } from '@insurance-max/shared-config';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { SelectQueryBuilder, In, IsNull, Repository } from 'typeorm';

import { TiramisDashboardQueryDto } from '../dto/tiramis-dashboard-query.dto';
import { TiramisSubmissionTrackingEntity } from '../entities/tiramis-submission-tracking.entity';
import { TiramisSubmissionStatus } from '../enums/tiramis-submission-status.enum';
import {
  ACTIVE_TIRAMIS_STATUSES,
  FAILED_TIRAMIS_STATUSES,
  PENDING_FINAL_TIRAMIS_STATUSES,
  getTiramisFailureMessage,
  isFailureTiramisStatus,
  isFinalTiramisStatus,
  normalizeTiramisPortalResponse,
  resolveSubmissionStatusFromNormalized,
} from '../utils/tiramis-response-normalizer.util';
import { calculateNextRetryAt } from '../utils/tiramis-retry.util';

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

  findByRequestId(requestId: string) {
    return this.repository.findOne({
      where: { tiramisRequestId: requestId },
      order: { createdAt: 'DESC' },
    });
  }

  findByTransactionId(transactionId: string) {
    return this.repository.findOne({
      where: { tiramisTransactionId: transactionId },
      order: { createdAt: 'DESC' },
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
      .andWhere('tracking.status IN (:...statuses)', {
        statuses: [
          TiramisSubmissionStatus.ACK_ACCEPTED,
          TiramisSubmissionStatus.ACKNOWLEDGED,
        ],
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
    const where: any[] = FAILED_TIRAMIS_STATUSES.map((status) => ({
      status,
    }));

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

  async findActiveDuplicateCandidate(params: {
    sourceCompanyId?: string | null;
    businessFingerprint?: string | null;
    idempotencyKey?: string | null;
    requestType?: string | null;
    sourceModule?: string | null;
    sourceRecordId?: string | null;
    businessReference?: string | null;
  }) {
    const where: any[] = [];

    if (params.sourceCompanyId && params.businessFingerprint) {
      where.push({
        sourceCompanyId: params.sourceCompanyId,
        businessFingerprint: params.businessFingerprint,
        status: In(ACTIVE_TIRAMIS_STATUSES),
        deletedAt: IsNull(),
      });
    }

    if (params.sourceCompanyId && params.idempotencyKey) {
      where.push({
        sourceCompanyId: params.sourceCompanyId,
        idempotencyKey: params.idempotencyKey,
        status: In(ACTIVE_TIRAMIS_STATUSES),
        deletedAt: IsNull(),
      });
    }

    if (
      params.sourceCompanyId &&
      params.requestType &&
      params.sourceModule &&
      params.sourceRecordId
    ) {
      where.push({
        sourceCompanyId: params.sourceCompanyId,
        requestType: params.requestType as any,
        sourceModule: params.sourceModule,
        sourceRecordId: params.sourceRecordId,
        status: In(ACTIVE_TIRAMIS_STATUSES),
        deletedAt: IsNull(),
      });
    }

    if (
      params.sourceCompanyId &&
      params.requestType &&
      params.sourceModule &&
      params.businessReference
    ) {
      where.push({
        sourceCompanyId: params.sourceCompanyId,
        requestType: params.requestType as any,
        sourceModule: params.sourceModule,
        businessReference: params.businessReference,
        status: In(ACTIVE_TIRAMIS_STATUSES),
        deletedAt: IsNull(),
      });
    }

    if (!where.length) {
      return null;
    }

    return this.repository.findOne({
      where,
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async markDuplicatePrevented(
    id: string,
    params: {
      duplicateOfTrackingId: string;
      reason: string;
    },
  ) {
    await this.repository.update(
      { id },
      {
        status: TiramisSubmissionStatus.DUPLICATE_PREVENTED,
        duplicateOfTrackingId: params.duplicateOfTrackingId,
        duplicatePreventionReason: params.reason,
        duplicateCheckedAt: new Date(),
        lastErrorMessage: params.reason,
        failedAt: new Date(),
        isRetryable: false,
        nextRetryAt: null,
        retryLockId: null,
        retryLockedAt: null,
      },
    );

    return this.findById(id);
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
          status: In(ACTIVE_TIRAMIS_STATUSES),
        },
        {
          sourceCompanyId: params.sourceCompanyId || undefined,
          requestType: params.requestType as any,
          sourceModule: params.sourceModule || undefined,
          sourceRecordId: params.sourceRecordId || undefined,
          businessReference: params.businessReference || undefined,
          status: In(ACTIVE_TIRAMIS_STATUSES),
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

  async findStatusSyncCandidates(params?: {
    limit?: number;
    callbackOverdueMinutes?: number;
  }) {
    const limit = Math.min(Math.max(Number(params?.limit || 50), 1), 200);

    return this.repository
      .createQueryBuilder('tracking')
      .where('tracking.deleted_at IS NULL')
      .andWhere('tracking.status IN (:...statuses)', {
        statuses: [
          TiramisSubmissionStatus.SENT_TO_TIRAMIS_SERVICE,
          TiramisSubmissionStatus.ACK_ACCEPTED,
          TiramisSubmissionStatus.ACKNOWLEDGED,
          TiramisSubmissionStatus.PENDING_FINAL,
          TiramisSubmissionStatus.CALLBACK_OVERDUE,
          TiramisSubmissionStatus.UNKNOWN,
        ],
      })
      .andWhere(
        '(tracking.final_response_id IS NULL OR tracking.final_response_status_code IS NULL)',
      )
      .orderBy('tracking.updated_at', 'ASC')
      .take(limit)
      .getMany();
  }

  findPendingFinalSync(limit = 50) {
    return this.repository.find({
      where: [
        {
          status: In(PENDING_FINAL_TIRAMIS_STATUSES),
          finalResponseId: IsNull(),
        },
      ],
      order: {
        updatedAt: 'ASC',
      },
      take: limit,
    });
  }

  async markRetryScheduled(
    id: string,
    params: {
      error?: any;
      baseDelaySeconds?: number;
      maxRetryAttempts?: number;
    },
  ) {
    const tracking = await this.findById(id);

    if (!tracking) {
      return null;
    }

    const retryAttempts = tracking.retryAttempts || 0;
    const maxRetryAttempts =
      tracking.maxRetryAttempts ||
      params.maxRetryAttempts ||
      Number(environment.TIRAMIS_RETRY_MAX_ATTEMPTS || 3);

    if (retryAttempts >= maxRetryAttempts) {
      return this.markRetryExhausted(id, {
        error: params.error,
      });
    }

    const nextRetryAt = calculateNextRetryAt({
      retryAttempts,
      baseDelaySeconds:
        params.baseDelaySeconds ||
        Number(environment.TIRAMIS_RETRY_BASE_DELAY_SECONDS || 60),
    });

    await this.repository.update(
      { id },
      {
        status: TiramisSubmissionStatus.RETRY_PENDING,
        isRetryable: true,
        nextRetryAt,
        maxRetryAttempts,
        retryErrorMessage:
          params.error?.message ||
          params.error?.response?.message ||
          String(params.error || 'Retry scheduled'),
        lastErrorMessage:
          params.error?.message ||
          params.error?.response?.message ||
          String(params.error || 'Retry scheduled'),
        retryLockId: null,
        retryLockedAt: null,
        retryStrategy: tracking.retryStrategy || 'EXPONENTIAL_BACKOFF',
      },
    );

    return this.findById(id);
  }

  async findRetryCandidates(params?: { limit?: number }) {
    const limit = Math.min(Math.max(Number(params?.limit || 25), 1), 100);
    const lockMinutes = Number(environment.TIRAMIS_RETRY_LOCK_MINUTES || 5);

    return this.repository
      .createQueryBuilder('tracking')
      .where('tracking.deleted_at IS NULL')
      .andWhere('tracking.is_retryable = true')
      .andWhere('tracking.status IN (:...statuses)', {
        statuses: [
          TiramisSubmissionStatus.RETRY_PENDING,
          TiramisSubmissionStatus.FAILED,
        ],
      })
      .andWhere(
        '(tracking.next_retry_at IS NULL OR tracking.next_retry_at <= now())',
      )
      .andWhere(
        `(tracking.retry_lock_id IS NULL OR tracking.retry_locked_at < now() - interval '${lockMinutes} minutes')`,
      )
      .andWhere('tracking.retry_attempts < tracking.max_retry_attempts')
      .orderBy('tracking.next_retry_at', 'ASC', 'NULLS FIRST')
      .take(limit)
      .getMany();
  }

  async acquireRetryLock(id: string, lockId: string) {
    const lockMinutes = Number(environment.TIRAMIS_RETRY_LOCK_MINUTES || 5);

    const result = await this.repository
      .createQueryBuilder()
      .update()
      .set({
        status: TiramisSubmissionStatus.RETRYING,
        retryLockId: lockId,
        retryLockedAt: new Date(),
        lastRetryAt: new Date(),
      })
      .where('id = :id', { id })
      .andWhere(
        `(retry_lock_id IS NULL OR retry_locked_at < now() - interval '${lockMinutes} minutes')`,
      )
      .andWhere('retry_attempts < max_retry_attempts')
      .execute();

    if (!result.affected) {
      return null;
    }

    return this.findById(id);
  }

  async markRetryAttemptFailed(
    id: string,
    params: {
      error?: any;
      baseDelaySeconds?: number;
    },
  ) {
    const tracking = await this.findById(id);

    if (!tracking) {
      return null;
    }

    const retryAttempts = (tracking.retryAttempts || 0) + 1;
    const maxRetryAttempts =
      tracking.maxRetryAttempts ||
      Number(environment.TIRAMIS_RETRY_MAX_ATTEMPTS || 3);

    if (retryAttempts >= maxRetryAttempts) {
      await this.repository.update(
        { id },
        {
          retryAttempts,
        },
      );

      return this.markRetryExhausted(id, {
        error: params.error,
      });
    }

    const nextRetryAt = calculateNextRetryAt({
      retryAttempts,
      baseDelaySeconds:
        params.baseDelaySeconds ||
        Number(environment.TIRAMIS_RETRY_BASE_DELAY_SECONDS || 60),
    });

    await this.repository.update(
      { id },
      {
        status: TiramisSubmissionStatus.RETRY_PENDING,
        retryAttempts,
        isRetryable: true,
        nextRetryAt,
        retryLockId: null,
        retryLockedAt: null,
        retryErrorMessage:
          params.error?.message ||
          params.error?.response?.message ||
          String(params.error || 'Retry failed'),
        lastErrorMessage:
          params.error?.message ||
          params.error?.response?.message ||
          String(params.error || 'Retry failed'),
      },
    );

    return this.findById(id);
  }

  async markRetryExhausted(
    id: string,
    params?: {
      error?: any;
    },
  ) {
    const errorMessage =
      params?.error?.message ||
      params?.error?.response?.message ||
      String(params?.error || 'Retry attempts exhausted');

    await this.repository.update(
      { id },
      {
        status: TiramisSubmissionStatus.RETRY_EXHAUSTED,
        isRetryable: false,
        nextRetryAt: null,
        retryLockId: null,
        retryLockedAt: null,
        retryErrorMessage: errorMessage,
        lastErrorMessage: errorMessage,
        failedAt: new Date(),
      },
    );

    return this.findById(id);
  }

  async markSubmittedResponse(
    id: string,
    response: any,
    options?: {
      clearRetry?: boolean;
      syncChecked?: boolean;
    },
  ) {
    const tracking = await this.findById(id);
    const normalized = normalizeTiramisPortalResponse(response);
    const resolvedStatus = resolveSubmissionStatusFromNormalized(normalized);
    const isFailure = isFailureTiramisStatus(resolvedStatus);
    const now = new Date();

    await this.repository.update(
      { id },
      {
        status: resolvedStatus,
        submittedAt: tracking?.submittedAt || now,
        tiramisTransactionId:
          normalized.transactionId || tracking?.tiramisTransactionId || null,
        tiramisRequestId:
          normalized.requestId || tracking?.tiramisRequestId || null,
        tiramisServiceType:
          normalized.serviceType || tracking?.tiramisServiceType || null,
        tiramisRootElement:
          normalized.rootElement || tracking?.tiramisRootElement || null,
        acknowledgementStatusCode:
          normalized.acknowledgement.statusCode ||
          tracking?.acknowledgementStatusCode ||
          null,
        acknowledgementStatusDesc:
          normalized.acknowledgement.statusDesc ||
          tracking?.acknowledgementStatusDesc ||
          null,
        acknowledgedAt: normalized.acknowledgement.statusCode
          ? tracking?.acknowledgedAt || now
          : tracking?.acknowledgedAt || null,
        finalResponseId:
          normalized.final.responseId || tracking?.finalResponseId || null,
        finalResponseStatusCode:
          normalized.final.statusCode ||
          tracking?.finalResponseStatusCode ||
          null,
        finalResponseStatusDesc:
          normalized.final.statusDesc ||
          tracking?.finalResponseStatusDesc ||
          null,
        finalResponseReceivedAt:
          normalized.final.statusCode || normalized.final.responseId
            ? normalized.final.receivedAt
              ? new Date(normalized.final.receivedAt)
              : now
            : tracking?.finalResponseReceivedAt || null,
        finalResponsePayload:
          normalized.final.payload || tracking?.finalResponsePayload || null,
        tiramisResponsePayload:
          response || tracking?.tiramisResponsePayload || null,
        lastSyncedAt: options?.syncChecked
          ? now
          : tracking?.lastSyncedAt || null,
        syncAttempts: options?.syncChecked
          ? (tracking?.syncAttempts || 0) + 1
          : tracking?.syncAttempts || 0,
        failedAt: isFailure
          ? tracking?.failedAt || now
          : tracking?.failedAt || null,
        lastErrorMessage: isFailure
          ? getTiramisFailureMessage(normalized) ||
            tracking?.lastErrorMessage ||
            'TIRAMIS submission failed'
          : null,
        isRetryable: options?.clearRetry
          ? false
          : tracking?.isRetryable || false,
        nextRetryAt: options?.clearRetry ? null : tracking?.nextRetryAt || null,
        retryLockId: options?.clearRetry ? null : tracking?.retryLockId || null,
        retryLockedAt: options?.clearRetry
          ? null
          : tracking?.retryLockedAt || null,
        retryErrorMessage: options?.clearRetry
          ? null
          : tracking?.retryErrorMessage || null,
      },
    );

    return this.findById(id);
  }

  async markSent(id: string, response: any) {
    return this.markSubmittedResponse(id, response);
  }

  async markAcknowledged(id: string, response: any) {
    return this.markSubmittedResponse(id, response);
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

    if (retryable) {
      return this.markRetryScheduled(id, {
        error,
        maxRetryAttempts:
          options?.maxRetryAttempts ||
          Number(environment.TIRAMIS_RETRY_MAX_ATTEMPTS || 3),
      });
    }

    await this.repository.update(
      { id },
      {
        status: TiramisSubmissionStatus.FAILED,
        isRetryable: false,
        nextRetryAt: null,
        failedAt: new Date(),
        lastErrorMessage:
          error?.message ||
          error?.response?.message ||
          error?.error?.message ||
          'TIRAMIS submission failed',
        retryErrorMessage: null,
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
      .andWhere(
        '(tracking.next_retry_at IS NULL OR tracking.next_retry_at <= now())',
      )
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
    return this.markSubmittedResponse(id, response, {
      clearRetry: true,
    });
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
          retryError:
            error?.response || error?.error || error?.message || error,
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
      .andWhere("retry_locked_at < now() - (:minutes * interval '1 minute')", {
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
        businessRecordSyncAttempts:
          (tracking?.businessRecordSyncAttempts || 0) + 1,
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
        businessRecordSyncAttempts:
          (tracking?.businessRecordSyncAttempts || 0) + 1,
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
        tiramisResponsePayload:
          response || tracking?.tiramisResponsePayload || null,
      },
    );

    return this.findById(id);
  }

  async markCallbackOverdue(
    id: string,
    params?: {
      reason?: string;
      response?: any;
    },
  ) {
    const tracking = await this.findById(id);

    await this.repository.update(
      { id },
      {
        status: TiramisSubmissionStatus.CALLBACK_OVERDUE,
        lastErrorMessage:
          params?.reason ||
          tracking?.lastErrorMessage ||
          'Final callback is overdue',
        tiramisResponsePayload:
          params?.response || tracking?.tiramisResponsePayload || null,
        lastSyncedAt: new Date(),
        syncAttempts: (tracking?.syncAttempts || 0) + 1,
        isRetryable: false,
        nextRetryAt: null,
      },
    );

    return this.findById(id);
  }

  async markFinalFromTiramisStatus(id: string, response: any) {
    const normalized = normalizeTiramisPortalResponse(response);
    const resolvedStatus = resolveSubmissionStatusFromNormalized(normalized);

    if (
      !normalized.final.statusCode &&
      !normalized.final.responseId &&
      !isFinalTiramisStatus(resolvedStatus) &&
      resolvedStatus !== TiramisSubmissionStatus.CALLBACK_OVERDUE
    ) {
      return this.markSyncChecked(id, response);
    }

    return this.markSubmittedResponse(id, response, {
      syncChecked: true,
    });
  }

  private calculateNextRetryAt(retryAttempts: number) {
    const delayMinutes = Math.min(
      Math.pow(2, retryAttempts),
      Number(environment.TIRAMIS_RETRY_MAX_DELAY_MINUTES || 30),
    );

    return new Date(Date.now() + delayMinutes * 60 * 1000);
  }

  async findLatestByBusinessRecord(params: {
    sourceModule: string;
    sourceRecordId: string;
    requestType?: string | null;
    sourceCompanyId?: string | null;
    canAccessAllCompanies?: boolean;
  }) {
    const query = this.repository
      .createQueryBuilder('tracking')
      .where('tracking.source_module = :sourceModule', {
        sourceModule: params.sourceModule,
      })
      .andWhere('tracking.source_record_id = :sourceRecordId', {
        sourceRecordId: params.sourceRecordId,
      })
      .orderBy('tracking.created_at', 'DESC');

    if (params.requestType) {
      query.andWhere('tracking.request_type = :requestType', {
        requestType: params.requestType,
      });
    }

    if (params.sourceCompanyId && !params.canAccessAllCompanies) {
      query.andWhere('tracking.source_company_id = :sourceCompanyId', {
        sourceCompanyId: params.sourceCompanyId,
      });
    }

    return query.getOne();
  }

  async findHistoryByBusinessRecord(params: {
    sourceModule: string;
    sourceRecordId: string;
    requestType?: string | null;
    sourceCompanyId?: string | null;
    canAccessAllCompanies?: boolean;
    limit?: number;
    includePayload?: boolean;
  }) {
    const query = this.repository
      .createQueryBuilder('tracking')
      .where('tracking.source_module = :sourceModule', {
        sourceModule: params.sourceModule,
      })
      .andWhere('tracking.source_record_id = :sourceRecordId', {
        sourceRecordId: params.sourceRecordId,
      })
      .orderBy('tracking.created_at', 'DESC')
      .take(params.limit || 50);

    if (params.requestType) {
      query.andWhere('tracking.request_type = :requestType', {
        requestType: params.requestType,
      });
    }

    if (params.sourceCompanyId && !params.canAccessAllCompanies) {
      query.andWhere('tracking.source_company_id = :sourceCompanyId', {
        sourceCompanyId: params.sourceCompanyId,
      });
    }

    const rows = await query.getMany();

    if (params.includePayload) {
      return rows;
    }

    return rows.map((row: any) => ({
      ...row,
      requestPayload: row.requestPayload ? '[hidden]' : null,
      tiramisResponsePayload: row.tiramisResponsePayload ? '[hidden]' : null,
      finalResponsePayload: row.finalResponsePayload ? '[hidden]' : null,
    }));
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
      qb.andWhere(
        'tracking.final_response_status_code = :finalResponseStatusCode',
        {
          finalResponseStatusCode: query.finalResponseStatusCode,
        },
      );
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
