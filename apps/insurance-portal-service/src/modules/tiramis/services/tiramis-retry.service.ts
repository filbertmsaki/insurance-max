import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { randomUUID } from 'crypto';

import { TiramisAuditAction } from '../enums/tiramis-audit-action.enum';
import { TiramisBusinessRecordSyncService } from './tiramis-business-record-sync.service';
import { TiramisClientService } from './tiramis-client.service';
import { TiramisSubmissionStatus } from '../enums/tiramis-submission-status.enum';
import { TiramisSubmissionTrackingRepository } from '../repositories/tiramis-submission-tracking.repository';
import { TiramisAuditService } from './tiramis-audit.service';
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

  /**
   * Runs every 3 minutes.
   * It retries only retryable submissions that have not reached max attempts.
   */
  @Cron('*/3 * * * *')
  async retryPendingSubmissions() {
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
      await this.trackingRepository.releaseStaleRetryLocks(
        Number(process.env.TIRAMIS_RETRY_LOCK_TIMEOUT_MINUTES || 15),
      );

      const limit = Number(process.env.TIRAMIS_RETRY_LIMIT || 20);
      const records = await this.trackingRepository.findRetryablePending(limit);

      let retried = 0;
      let success = 0;
      let failed = 0;
      let exhausted = 0;

      for (const record of records) {
        const lockId = randomUUID();

        try {
          const locked = await this.trackingRepository.markRetrying(
            record.id,
            lockId,
          );

          await this.businessRecordSyncService.syncFromTracking(locked);

          await this.auditService.logFromTracking({
            action: TiramisAuditAction.RETRY_REQUESTED,
            tracking: locked,
            statusBefore: record.status,
            success: true,
            metadata: {
              automatic: true,
            },
          });

          const response = await this.tiramisClientService.resendTrackingRecord(
            record.id,
          );

          const updated = await this.trackingRepository.markRetrySuccess(
            record.id,
            response,
          );

          await this.businessRecordSyncService.syncFromTracking(updated);

          const acknowledgementCode =
            response?.acknowledgement?.statusCode ||
            response?.tiraResponse?.acknowledgementStatusCode ||
            response?.tiraResponse?.AcknowledgementStatusCode ||
            null;

          if (acknowledgementCode) {
            const acknowledgedTracking =
              await this.trackingRepository.markAcknowledged(
                record.id,
                response,
              );

            await this.businessRecordSyncService.syncFromTracking(
              acknowledgedTracking,
            );
          }

          retried += 1;
          success += 1;

          await this.auditService.logFromTracking({
            action: TiramisAuditAction.RETRY_SUCCESS,
            tracking: updated,
            statusBefore: record.status,
            success: true,
            metadata: {
              automatic: true,
            },
          });
        } catch (error: any) {
          retried += 1;
          failed += 1;

          this.logger.warn(
            `Retry failed for local tracking ${record.id}: ${error?.message || error}`,
          );

          const updated = await this.trackingRepository.markRetryFailed(
            record.id,
            error,
          );

          await this.businessRecordSyncService.syncFromTracking(updated);

          if (updated?.status === TiramisSubmissionStatus.RETRY_EXHAUSTED) {
            await this.notificationService.notifyRetryExhausted({
              tracking: updated,
              error,
              metadata: {
                automatic: true,
              },
            });
          }

          await this.auditService.logFromTracking({
            action:
              updated?.status === TiramisSubmissionStatus.RETRY_EXHAUSTED
                ? TiramisAuditAction.RETRY_EXHAUSTED
                : TiramisAuditAction.RETRY_FAILED,
            tracking: updated,
            statusBefore: record.status,
            success: false,
            error,
            metadata: {
              automatic: true,
            },
          });

          if (updated?.status === TiramisSubmissionStatus.RETRY_EXHAUSTED) {
            exhausted += 1;
          }
        }
      }

      return {
        scanned: records.length,
        retried,
        success,
        failed,
        exhausted,
      };
    } finally {
      this.isRunning = false;
    }
  }

  async retryOne(localTrackingId: string) {
    const record = await this.trackingRepository.findById(localTrackingId);

    if (!record) {
      return {
        found: false,
        message: 'Local TIRAMIS tracking record not found',
      };
    }

    if (
      ![
        TiramisSubmissionStatus.RETRY_PENDING,
        TiramisSubmissionStatus.RETRY_EXHAUSTED,
        TiramisSubmissionStatus.FAILED,
        TiramisSubmissionStatus.UNKNOWN,
      ].includes(record.status as TiramisSubmissionStatus)
    ) {
      return {
        found: true,
        retryAllowed: false,
        message: `Tracking status ${record.status} is not retryable`,
        tracking: record,
      };
    }

    const locked = await this.trackingRepository.markRetrying(
      record.id,
      randomUUID(),
    );

    await this.businessRecordSyncService.syncFromTracking(locked);

    await this.auditService.logFromTracking({
      action: TiramisAuditAction.RETRY_REQUESTED,
      tracking: locked,
      statusBefore: record.status,
      success: true,
      metadata: {
        manual: true,
      },
    });

    try {
      const response = await this.tiramisClientService.resendTrackingRecord(
        record.id,
      );

      const updated = await this.trackingRepository.markRetrySuccess(
        record.id,
        response,
      );

      await this.businessRecordSyncService.syncFromTracking(updated);

      const acknowledgementCode =
        response?.acknowledgement?.statusCode ||
        response?.tiraResponse?.acknowledgementStatusCode ||
        response?.tiraResponse?.AcknowledgementStatusCode ||
        null;

      let finalTracking = updated;

      if (acknowledgementCode) {
        finalTracking = await this.trackingRepository.markAcknowledged(
          record.id,
          response,
        );

        await this.businessRecordSyncService.syncFromTracking(finalTracking);
      }

      return {
        found: true,
        retryAllowed: true,
        success: true,
        tracking: finalTracking,
        tiramis: response,
      };
    } catch (error: any) {
      const updated = await this.trackingRepository.markRetryFailed(
        record.id,
        error,
      );

      await this.businessRecordSyncService.syncFromTracking(updated);

      if (updated?.status === TiramisSubmissionStatus.RETRY_EXHAUSTED) {
        await this.notificationService.notifyRetryExhausted({
          tracking: updated,
          error,
          metadata: {
            manual: true,
          },
        });
      }

      await this.auditService.logFromTracking({
        action:
          updated?.status === TiramisSubmissionStatus.RETRY_EXHAUSTED
            ? TiramisAuditAction.RETRY_EXHAUSTED
            : TiramisAuditAction.RETRY_FAILED,
        tracking: updated,
        statusBefore: record.status,
        success: false,
        error,
        metadata: {
          manual: true,
        },
      });

      return {
        found: true,
        retryAllowed: true,
        success: false,
        tracking: updated,
        error: error?.response || error?.message || error,
      };
    }
  }
}
