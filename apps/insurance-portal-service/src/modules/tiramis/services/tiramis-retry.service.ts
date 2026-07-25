import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { TiramisAuditAction } from '../enums/tiramis-audit-action.enum';
import { TiramisSubmissionStatus } from '../enums/tiramis-submission-status.enum';
import { TiramisSubmissionTrackingEntity } from '../entities/tiramis-submission-tracking.entity';
import { TiramisSubmissionTrackingRepository } from '../repositories/tiramis-submission-tracking.repository';
import { buildRetryLockId } from '../utils/tiramis-retry.util';
import { TiramisAuditService } from './tiramis-audit.service';
import { TiramisBusinessRecordSyncService } from './tiramis-business-record-sync.service';
import { TiramisClientService } from './tiramis-client.service';
import { TiramisNotificationService } from './tiramis-notification.service';

@Injectable()
export class TiramisRetryService {
  private readonly logger = new Logger(TiramisRetryService.name);

  private isRunning = false;

  constructor(
    private readonly trackingRepository: TiramisSubmissionTrackingRepository,
    private readonly tiramisClientService: TiramisClientService,
    private readonly businessRecordSyncService: TiramisBusinessRecordSyncService,
    private readonly auditService: TiramisAuditService,
    private readonly notificationService: TiramisNotificationService,
  ) {}

  @Cron(process.env.TIRAMIS_RETRY_CRON || '*/3 * * * *')
  async handleCron() {
    return this.retryPendingSubmissions({
      automatic: true,
    });
  }

  async retryPendingSubmissions(options?: {
    automatic?: boolean;
    limit?: number;
  }) {
    if (process.env.TIRAMIS_RETRY_ENABLED === 'false') {
      return {
        skipped: true,
        reason: 'TIRAMIS_RETRY_ENABLED=false',
      };
    }

    if (this.isRunning) {
      return {
        skipped: true,
        reason: 'already_running',
      };
    }

    this.isRunning = true;

    try {
      const limit = Number(
        options?.limit || process.env.TIRAMIS_RETRY_LIMIT || 25,
      );

      const candidates = await this.trackingRepository.findRetryCandidates({
        limit,
      });

      const result = {
        scanned: candidates.length,
        retried: 0,
        success: 0,
        failed: 0,
        exhausted: 0,
        skipped: 0,
        items: [] as any[],
      };

      for (const record of candidates) {
        const item = await this.retryTrackingRecord(record, {
          automatic: !!options?.automatic,
        });

        result.items.push(item);

        if (item.skipped) {
          result.skipped += 1;
          continue;
        }

        result.retried += 1;

        if (item.status === TiramisSubmissionStatus.RETRY_EXHAUSTED) {
          result.exhausted += 1;
        } else if (item.success) {
          result.success += 1;
        } else {
          result.failed += 1;
        }
      }

      return result;
    } finally {
      this.isRunning = false;
    }
  }

  async retryOne(localTrackingId: string) {
    const record = await this.trackingRepository.findById(localTrackingId);

    if (!record) {
      return {
        found: false,
        message: 'TIRAMIS tracking record not found',
      };
    }

    return {
      found: true,
      ...(await this.retryTrackingRecord(record, {
        automatic: false,
        force: true,
      })),
    };
  }

  async scheduleRetry(localTrackingId: string, reason?: string) {
    const record = await this.trackingRepository.findById(localTrackingId);

    if (!record) {
      return {
        found: false,
        message: 'TIRAMIS tracking record not found',
      };
    }

    const updated = await this.trackingRepository.markRetryScheduled(
      record.id,
      {
        error: new Error(reason || 'Manual retry scheduled'),
        maxRetryAttempts: Number(process.env.TIRAMIS_RETRY_MAX_ATTEMPTS || 3),
      },
    );

    await this.businessRecordSyncService.syncFromTracking(updated);

    await this.auditService.logFromTracking({
      action: TiramisAuditAction.RETRY_REQUESTED,
      tracking: updated || record,
      statusBefore: record.status,
      success: true,
      metadata: {
        manual: true,
        reason,
      },
    });

    return {
      found: true,
      scheduled: true,
      tracking: updated,
    };
  }

  private async retryTrackingRecord(
    record: TiramisSubmissionTrackingEntity,
    options: {
      automatic: boolean;
      force?: boolean;
    },
  ) {
    if (!options.force && !record.isRetryable) {
      return {
        trackingId: record.id,
        skipped: true,
        reason: 'record_not_retryable',
        status: record.status,
      };
    }

    if (
      !options.force &&
      record.nextRetryAt &&
      new Date(record.nextRetryAt).getTime() > Date.now()
    ) {
      return {
        trackingId: record.id,
        skipped: true,
        reason: 'next_retry_time_not_reached',
        status: record.status,
        nextRetryAt: record.nextRetryAt,
      };
    }

    const lockId = buildRetryLockId();

    const locked = await this.trackingRepository.acquireRetryLock(
      record.id,
      lockId,
    );

    if (!locked) {
      return {
        trackingId: record.id,
        skipped: true,
        reason: 'retry_lock_not_acquired',
        status: record.status,
      };
    }

    await this.businessRecordSyncService.syncFromTracking(locked);

    await this.auditService.logFromTracking({
      action: TiramisAuditAction.RETRY_REQUESTED,
      tracking: locked,
      statusBefore: record.status,
      success: true,
      metadata: {
        automatic: options.automatic,
        retryAttempts: locked.retryAttempts,
        lockId,
      },
    });

    try {
      const response = await this.tiramisClientService.resendTrackingRecord(
        locked.id,
      );

      const updated = await this.trackingRepository.markRetrySuccess(
        locked.id,
        response,
      );

      await this.businessRecordSyncService.syncFromTracking(updated);

      const failedLocally = this.isFailureLocalStatus(updated?.status);

      await this.auditService.logFromTracking({
        action: failedLocally
          ? TiramisAuditAction.RETRY_FAILED
          : TiramisAuditAction.RETRY_SUCCESS,
        tracking: updated || locked,
        statusBefore: locked.status,
        success: !failedLocally,
        metadata: {
          automatic: options.automatic,
          lockId,
        },
      });

      return {
        trackingId: locked.id,
        skipped: false,
        success: !failedLocally,
        status: updated?.status,
        tracking: updated,
        tiramis: response,
      };
    } catch (error: any) {
      this.logger.warn(
        `Retry failed for local tracking ${locked.id}: ${error?.message || error}`,
      );

      const updated = await this.trackingRepository.markRetryAttemptFailed(
        locked.id,
        {
          error,
        },
      );

      await this.businessRecordSyncService.syncFromTracking(updated);

      await this.auditService.logFromTracking({
        action:
          updated?.status === TiramisSubmissionStatus.RETRY_EXHAUSTED
            ? TiramisAuditAction.RETRY_EXHAUSTED
            : TiramisAuditAction.RETRY_FAILED,
        tracking: updated || locked,
        statusBefore: locked.status,
        success: false,
        error,
        metadata: {
          automatic: options.automatic,
          lockId,
        },
      });

      if (updated?.status === TiramisSubmissionStatus.RETRY_EXHAUSTED) {
        await this.notificationService.notifyRetryExhausted({
          tracking: updated,
          error,
          metadata: {
            automatic: options.automatic,
            lockId,
          },
        });
      } else {
        await this.notificationService.notifyRetryFailed({
          tracking: updated,
          error,
          metadata: {
            automatic: options.automatic,
            lockId,
          },
        });
      }

      return {
        trackingId: locked.id,
        skipped: false,
        success: false,
        status: updated?.status,
        tracking: updated,
        error: error?.message || String(error),
      };
    }
  }

  private isFailureLocalStatus(status?: string | null): boolean {
    return [
      TiramisSubmissionStatus.ACK_FAILED,
      TiramisSubmissionStatus.FINAL_FAILED,
      TiramisSubmissionStatus.FAILED,
      TiramisSubmissionStatus.RETRY_EXHAUSTED,
      TiramisSubmissionStatus.CALLBACK_OVERDUE,
    ].includes(status as TiramisSubmissionStatus);
  }
}
