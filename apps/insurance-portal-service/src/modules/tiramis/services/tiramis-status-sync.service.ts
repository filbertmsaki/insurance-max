import { environment } from '@insurance-max/shared-config';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { TiramisAuditAction } from '../enums/tiramis-audit-action.enum';
import { TiramisSubmissionStatus } from '../enums/tiramis-submission-status.enum';
import { TiramisSubmissionTrackingEntity } from '../entities/tiramis-submission-tracking.entity';
import { TiramisSubmissionTrackingRepository } from '../repositories/tiramis-submission-tracking.repository';
import { TiramisAuditService } from './tiramis-audit.service';
import { TiramisBusinessRecordSyncService } from './tiramis-business-record-sync.service';
import { TiramisClientService } from './tiramis-client.service';
import { TiramisNotificationService } from './tiramis-notification.service';

@Injectable()
export class TiramisStatusSyncService {
  private readonly logger = new Logger(TiramisStatusSyncService.name);

  private isRunning = false;

  constructor(
    private readonly trackingRepository: TiramisSubmissionTrackingRepository,
    private readonly tiramisClientService: TiramisClientService,
    private readonly businessRecordSyncService: TiramisBusinessRecordSyncService,
    private readonly auditService: TiramisAuditService,
    private readonly notificationService: TiramisNotificationService,
  ) {}

  @Cron(environment.TIRAMIS_STATUS_SYNC_CRON || '*/2 * * * *')
  async handleCron() {
    return this.syncPendingFinalStatuses({
      automatic: true,
    });
  }

  async syncPendingFinalStatuses(options?: {
    automatic?: boolean;
    limit?: number;
  }) {
    if (environment.TIRAMIS_STATUS_SYNC_ENABLED === 'false') {
      return {
        skipped: true,
        reason: 'TIRAMIS_STATUS_SYNC_ENABLED=false',
      };
    }

    if (this.isRunning) {
      this.logger.warn('TIRAMIS status sync already running, skipping');

      return {
        skipped: true,
        reason: 'already_running',
      };
    }

    this.isRunning = true;

    try {
      const limit = Number(
        options?.limit || environment.TIRAMIS_STATUS_SYNC_LIMIT || 50,
      );

      const callbackOverdueMinutes = Number(
        environment.TIRAMIS_CALLBACK_OVERDUE_MINUTES || 10,
      );

      const records = await this.trackingRepository.findStatusSyncCandidates({
        limit,
        callbackOverdueMinutes,
      });

      const result = {
        scanned: records.length,
        synced: 0,
        finalSuccess: 0,
        finalFailed: 0,
        callbackOverdue: 0,
        noChange: 0,
        failed: 0,
        items: [] as any[],
      };

      for (const record of records) {
        try {
          const item = await this.syncTrackingRecord(record, {
            automatic: !!options?.automatic,
            callbackOverdueMinutes,
          });

          result.items.push(item);
          result.synced += 1;

          if (item.status === TiramisSubmissionStatus.FINAL_SUCCESS) {
            result.finalSuccess += 1;
          } else if (item.status === TiramisSubmissionStatus.FINAL_FAILED) {
            result.finalFailed += 1;
          } else if (item.status === TiramisSubmissionStatus.CALLBACK_OVERDUE) {
            result.callbackOverdue += 1;
          } else {
            result.noChange += 1;
          }
        } catch (error: any) {
          result.failed += 1;

          this.logger.warn(
            `Failed to sync TIRAMIS status for local tracking ${record.id}: ${
              error?.message || error
            }`,
          );

          await this.trackingRepository.markSyncChecked(record.id, {
            syncError: error?.response || error?.message || String(error),
          });

          await this.auditService.logFromTracking({
            action: TiramisAuditAction.STATUS_SYNC_FAILED,
            tracking: record,
            statusBefore: record.status,
            success: false,
            error,
            metadata: {
              automatic: !!options?.automatic,
            },
          });

          await this.notificationService.notifyStatusSyncFailed({
            tracking: record,
            error,
            metadata: {
              automatic: !!options?.automatic,
            },
          });
        }
      }

      return result;
    } finally {
      this.isRunning = false;
    }
  }

  async syncOne(localTrackingId: string) {
    const record = await this.trackingRepository.findById(localTrackingId);

    if (!record) {
      return {
        found: false,
        message: 'Local TIRAMIS tracking record not found',
      };
    }

    await this.auditService.logFromTracking({
      action: TiramisAuditAction.STATUS_SYNC_REQUESTED,
      tracking: record,
      statusBefore: record.status,
      success: true,
      metadata: {
        manual: true,
      },
    });

    const item = await this.syncTrackingRecord(record, {
      automatic: false,
      callbackOverdueMinutes: Number(
        environment.TIRAMIS_CALLBACK_OVERDUE_MINUTES || 10,
      ),
    });

    return {
      found: true,
      ...item,
    };
  }

  async syncLatestBusinessRecord(params: {
    sourceModule: string;
    sourceRecordId: string;
    requestType?: string | null;
    sourceCompanyId?: string | null;
    canAccessAllCompanies?: boolean;
  }) {
    const latest = await this.trackingRepository.findLatestByBusinessRecord({
      sourceModule: params.sourceModule,
      sourceRecordId: params.sourceRecordId,
      requestType: params.requestType || null,
      sourceCompanyId: params.sourceCompanyId || null,
      canAccessAllCompanies: !!params.canAccessAllCompanies,
    });

    if (!latest) {
      return {
        found: false,
        message: 'No TIRAMIS tracking record found for this business record',
        sourceModule: params.sourceModule,
        sourceRecordId: params.sourceRecordId,
        requestType: params.requestType || null,
      };
    }

    return this.syncOne(latest.id);
  }

  private async syncTrackingRecord(
    record: TiramisSubmissionTrackingEntity,
    options: {
      automatic: boolean;
      callbackOverdueMinutes: number;
    },
  ) {
    const statusBefore = record.status;

    const response = await this.tiramisClientService.getStatus({
      transactionId: record.tiramisTransactionId || undefined,
      requestId: record.tiramisRequestId || undefined,
      businessReference: record.businessReference || undefined,
      includePayload:
        environment.TIRAMIS_STATUS_SYNC_INCLUDE_PAYLOAD !== 'false',
    });

    let updated = await this.trackingRepository.markFinalFromTiramisStatus(
      record.id,
      response,
    );

    if (!updated) {
      return {
        trackingId: record.id,
        statusBefore,
        status: record.status,
        changed: false,
        reason: 'tracking_update_failed',
        tiramis: response,
      };
    }

    if (
      !this.hasFinalResponse(updated) &&
      this.isCallbackOverdue(updated, options.callbackOverdueMinutes)
    ) {
      updated = await this.trackingRepository.markCallbackOverdue(updated.id, {
        reason: `Final callback is overdue after ${options.callbackOverdueMinutes} minutes`,
        response,
      });

      if (!updated) {
        return {
          trackingId: record.id,
          statusBefore,
          status: record.status,
          changed: false,
          reason: 'callback_overdue_update_failed',
          tiramis: response,
        };
      }
    }

    const businessRecordSync =
      await this.businessRecordSyncService.syncFromTracking(updated);

    await this.sendFinalNotifications(updated, {
      automatic: options.automatic,
    });

    await this.auditService.logFromTracking({
      action: TiramisAuditAction.STATUS_SYNC_SUCCESS,
      tracking: updated,
      statusBefore,
      success: true,
      metadata: {
        automatic: options.automatic,
        businessRecordSync,
      },
    });

    return {
      trackingId: updated.id,
      statusBefore,
      status: updated.status,
      changed: statusBefore !== updated.status,
      businessRecordSync,
      tiramis: response,
    };
  }

  private hasFinalResponse(record: TiramisSubmissionTrackingEntity): boolean {
    return (
      !!record.finalResponseId ||
      !!record.finalResponseStatusCode ||
      record.status === TiramisSubmissionStatus.FINAL_SUCCESS ||
      record.status === TiramisSubmissionStatus.FINAL_FAILED
    );
  }

  private isCallbackOverdue(
    record: TiramisSubmissionTrackingEntity,
    overdueMinutes: number,
  ): boolean {
    if (
      record.status === TiramisSubmissionStatus.FINAL_SUCCESS ||
      record.status === TiramisSubmissionStatus.FINAL_FAILED ||
      record.status === TiramisSubmissionStatus.ACK_FAILED ||
      record.status === TiramisSubmissionStatus.FAILED ||
      record.status === TiramisSubmissionStatus.RETRY_EXHAUSTED
    ) {
      return false;
    }

    const baseDate =
      record.acknowledgedAt || record.submittedAt || record.createdAt || null;

    if (!baseDate) {
      return false;
    }

    const ageMs = Date.now() - new Date(baseDate).getTime();
    const overdueMs = overdueMinutes * 60 * 1000;

    return ageMs >= overdueMs;
  }

  private async sendFinalNotifications(
    updated: TiramisSubmissionTrackingEntity,
    metadata: Record<string, any>,
  ) {
    const notificationService = this.notificationService as any;

    if (updated.status === TiramisSubmissionStatus.FINAL_FAILED) {
      if (typeof notificationService.notifyFinalResponseFailed === 'function') {
        await notificationService.notifyFinalResponseFailed({
          tracking: updated,
          metadata,
        });
      }

      return;
    }

    if (updated.status === TiramisSubmissionStatus.CALLBACK_OVERDUE) {
      if (typeof notificationService.notifyCallbackOverdue === 'function') {
        await notificationService.notifyCallbackOverdue({
          tracking: updated,
          metadata,
        });
      }

      return;
    }

    if (updated.status === TiramisSubmissionStatus.FINAL_SUCCESS) {
      if (
        typeof notificationService.notifyFinalResponseSuccess === 'function'
      ) {
        await notificationService.notifyFinalResponseSuccess({
          tracking: updated,
          metadata,
        });
      }
    }
  }
}
