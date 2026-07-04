import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { TiramisSubmissionTrackingRepository } from '../repositories/tiramis-submission-tracking.repository';
import { TiramisClientService } from './tiramis-client.service';

@Injectable()
export class TiramisStatusSyncService {
  private readonly logger = new Logger(TiramisStatusSyncService.name);

  private isRunning = false;

  constructor(
    private readonly trackingRepository: TiramisSubmissionTrackingRepository,
    private readonly tiramisClientService: TiramisClientService,
  ) {}

  /**
   * Runs every 2 minutes.
   * Increase/decrease based on traffic and TIRA callback speed.
   */
  @Cron('*/2 * * * *')
  async syncPendingFinalStatuses() {
    if (process.env.TIRAMIS_STATUS_SYNC_ENABLED === 'false') {
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
      const limit = Number(process.env.TIRAMIS_STATUS_SYNC_LIMIT || 50);
      const records = await this.trackingRepository.findPendingFinalSync(limit);

      let synced = 0;
      let updatedFinal = 0;
      let failed = 0;

      for (const record of records) {
        try {
          const response = await this.tiramisClientService.getStatus({
            transactionId: record.tiramisTransactionId || undefined,
            requestId: record.tiramisRequestId || undefined,
            businessReference: record.businessReference || undefined,
            includePayload: true,
          });

          const updated = await this.trackingRepository.markFinalFromTiramisStatus(
            record.id,
            response,
          );

          synced += 1;

          if (
            updated?.status === 'FINAL_SUCCESS' ||
            updated?.status === 'FINAL_FAILED'
          ) {
            updatedFinal += 1;
          }
        } catch (error: any) {
          failed += 1;

          this.logger.warn(
            `Failed to sync TIRAMIS status for local tracking ${record.id}: ${
              error?.message || error
            }`,
          );

          await this.trackingRepository.markSyncChecked(record.id, {
            syncError: error?.response || error?.message || error,
          });
        }
      }

      return {
        scanned: records.length,
        synced,
        updatedFinal,
        failed,
      };
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

    const response = await this.tiramisClientService.getStatus({
      transactionId: record.tiramisTransactionId || undefined,
      requestId: record.tiramisRequestId || undefined,
      businessReference: record.businessReference || undefined,
      includePayload: true,
    });

    const updated = await this.trackingRepository.markFinalFromTiramisStatus(
      record.id,
      response,
    );

    return {
      found: true,
      updated,
      tiramis: response,
    };
  }
}
