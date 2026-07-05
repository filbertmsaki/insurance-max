import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { resolveTiramisBusinessRecordMapping } from '../constants/tiramis-business-record-map.constant';
import { TiramisAuditAction } from '../enums/tiramis-audit-action.enum';
import { TiramisSubmissionTrackingEntity } from '../entities/tiramis-submission-tracking.entity';
import { TiramisSubmissionStatus } from '../enums/tiramis-submission-status.enum';
import { TiramisSubmissionTrackingRepository } from '../repositories/tiramis-submission-tracking.repository';
import { TiramisAuditService } from './tiramis-audit.service';

@Injectable()
export class TiramisBusinessRecordSyncService {
  private readonly logger = new Logger(TiramisBusinessRecordSyncService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly trackingRepository: TiramisSubmissionTrackingRepository,
    private readonly auditService: TiramisAuditService,
  ) {}

  async syncFromTracking(
    tracking: TiramisSubmissionTrackingEntity | null | undefined,
  ) {
    if (!tracking) {
      return {
        synced: false,
        reason: 'tracking_not_found',
      };
    }

    if (!tracking.sourceRecordId) {
      return {
        synced: false,
        reason: 'source_record_id_missing',
      };
    }

    await this.auditService.logFromTracking({
      action: TiramisAuditAction.BUSINESS_RECORD_SYNC_REQUESTED,
      tracking,
      success: true,
    });

    const mapping = resolveTiramisBusinessRecordMapping({
      sourceModule: tracking.sourceModule,
      requestType: tracking.requestType,
    });

    if (!mapping) {
      return {
        synced: false,
        reason: 'business_table_mapping_not_found',
      };
    }

    try {
      const tableName = this.quoteIdentifier(mapping.tableName);
      const idColumn = this.quoteIdentifier(mapping.idColumn);

      const sql = `
        UPDATE ${tableName}
        SET
          tiramis_submission_tracking_id = $1,
          tiramis_status = $2,
          tiramis_transaction_id = $3,
          tiramis_request_id = $4,
          tiramis_service_type = $5,
          tiramis_root_element = $6,
          tiramis_acknowledgement_status_code = $7,
          tiramis_acknowledgement_status_desc = $8,
          tiramis_final_response_id = $9,
          tiramis_final_response_status_code = $10,
          tiramis_final_response_status_desc = $11,
          tiramis_last_error_message = $12,
          tiramis_last_synced_at = now(),
          updated_at = now()
        WHERE ${idColumn} = $13
      `;

      await this.dataSource.query(sql, [
        tracking.id,
        tracking.status,
        tracking.tiramisTransactionId || null,
        tracking.tiramisRequestId || null,
        tracking.tiramisServiceType || null,
        tracking.tiramisRootElement || null,
        tracking.acknowledgementStatusCode || null,
        tracking.acknowledgementStatusDesc || null,
        tracking.finalResponseId || null,
        tracking.finalResponseStatusCode || null,
        tracking.finalResponseStatusDesc || null,
        tracking.lastErrorMessage || null,
        tracking.sourceRecordId,
      ]);

      await this.trackingRepository.markBusinessRecordSynced(tracking.id);

      await this.auditService.logFromTracking({
        action: TiramisAuditAction.BUSINESS_RECORD_SYNC_SUCCESS,
        tracking,
        success: true,
        metadata: {
          tableName: mapping.tableName,
          sourceRecordId: tracking.sourceRecordId,
        },
      });

      return {
        synced: true,
        tableName: mapping.tableName,
        sourceRecordId: tracking.sourceRecordId,
        status: tracking.status,
      };
    } catch (error: any) {
      this.logger.warn(
        `Failed to sync TIRAMIS status to business record ${tracking.sourceRecordId}: ${
          error?.message || error
        }`,
      );

      await this.trackingRepository.markBusinessRecordSyncFailed(
        tracking.id,
        error,
      );

      await this.auditService.logFromTracking({
        action: TiramisAuditAction.BUSINESS_RECORD_SYNC_FAILED,
        tracking,
        success: false,
        error,
        metadata: {
          sourceRecordId: tracking.sourceRecordId,
        },
      });

      return {
        synced: false,
        reason: 'sync_failed',
        error: error?.message || error,
      };
    }
  }

  private quoteIdentifier(identifier: string): string {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
      throw new Error(`Unsafe SQL identifier: ${identifier}`);
    }

    return `"${identifier}"`;
  }

  isFinalStatus(status: string) {
    return [
      TiramisSubmissionStatus.FINAL_SUCCESS,
      TiramisSubmissionStatus.FINAL_FAILED,
      TiramisSubmissionStatus.FAILED,
      TiramisSubmissionStatus.RETRY_EXHAUSTED,
    ].includes(status as TiramisSubmissionStatus);
  }
}
