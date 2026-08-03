import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { resolveTiramisBusinessRecordMapping } from '../constants/tiramis-business-record-map.constant';
import { TiramisAuditAction } from '../enums/tiramis-audit-action.enum';
import { TiramisSubmissionTrackingEntity } from '../entities/tiramis-submission-tracking.entity';
import { TiramisRequestType } from '../enums/tiramis-request-type.enum';
import { TiramisSubmissionStatus } from '../enums/tiramis-submission-status.enum';
import { TiramisSubmissionTrackingRepository } from '../repositories/tiramis-submission-tracking.repository';
import { TiramisAuditService } from './tiramis-audit.service';
import { TiramisNotificationService } from './tiramis-notification.service';

@Injectable()
export class TiramisBusinessRecordSyncService {
  private readonly logger = new Logger(TiramisBusinessRecordSyncService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly trackingRepository: TiramisSubmissionTrackingRepository,
    private readonly auditService: TiramisAuditService,
    private readonly notificationService: TiramisNotificationService,
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
      await this.notificationService.notifyBusinessRecordSyncFailed({
        tracking,
        metadata: {
          sourceRecordId: tracking.sourceRecordId,
          reason: 'business_table_mapping_not_found',
        },
      });

      await this.auditService.logFromTracking({
        action: TiramisAuditAction.BUSINESS_RECORD_SYNC_FAILED,
        tracking,
        success: false,
        metadata: {
          sourceRecordId: tracking.sourceRecordId,
          reason: 'business_table_mapping_not_found',
        },
      });

      return {
        synced: false,
        reason: 'business_table_mapping_not_found',
      };
    }

    try {
      const tableName = this.quoteIdentifier(mapping.tableName);
      const idColumn = this.quoteIdentifier(mapping.idColumn);
      const updateEntries: Array<[string, any]> = [
        ['tiramis_submission_tracking_id', tracking.id],
        ['tiramis_status', tracking.status],
        ['tiramis_transaction_id', tracking.tiramisTransactionId || null],
        ['tiramis_request_id', tracking.tiramisRequestId || null],
        ['tiramis_service_type', tracking.tiramisServiceType || null],
        ['tiramis_root_element', tracking.tiramisRootElement || null],
        [
          'tiramis_acknowledgement_status_code',
          tracking.acknowledgementStatusCode || null,
        ],
        [
          'tiramis_acknowledgement_status_desc',
          tracking.acknowledgementStatusDesc || null,
        ],
        ['tiramis_final_response_id', tracking.finalResponseId || null],
        [
          'tiramis_final_response_status_code',
          tracking.finalResponseStatusCode || null,
        ],
        [
          'tiramis_final_response_status_desc',
          tracking.finalResponseStatusDesc || null,
        ],
        ['tiramis_last_error_message', tracking.lastErrorMessage || null],
      ];
      const filteredEntries = updateEntries.filter(
        ([, value]) => value !== undefined,
      );
      const setClauses = filteredEntries.map(
        ([column], index) => `${this.quoteIdentifier(column)} = $${index + 1}`,
      );
      const { whereClause, parameters: matchParameters } =
        this.buildSyncMatchCondition(
          mapping.tableName,
          mapping.idColumn,
          tracking,
          filteredEntries.length + 1,
        );

      const sql = `
        UPDATE ${tableName}
        SET
          ${setClauses.join(',\n          ')},
          tiramis_last_synced_at = now(),
          updated_at = now()
        WHERE ${whereClause}
      `;

      await this.dataSource.query(sql, [
        ...filteredEntries.map(([, value]) => value),
        ...matchParameters,
      ]);

      await this.trackingRepository.markBusinessRecordSynced(tracking.id);

      await this.syncReinsuranceOutcomeIfNeeded(tracking);

      await this.auditService.logFromTracking({
        action: TiramisAuditAction.BUSINESS_RECORD_SYNC_SUCCESS,
        tracking,
        success: true,
        metadata: {
          tableName: mapping.tableName,
          sourceRecordId: tracking.sourceRecordId,
        },
      });

      await this.notificationService.notifyBusinessRecordSyncSuccess({
        tracking,
        metadata: {
          tableName: mapping.tableName,
          sourceRecordId: tracking.sourceRecordId,
          updatedColumns: filteredEntries.map(([column]) => column),
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

      const failedTracking =
        await this.trackingRepository.markBusinessRecordSyncFailed(
          tracking.id,
          error,
        );

      await this.notificationService.notifyBusinessRecordSyncFailed({
        tracking: failedTracking || tracking,
        error,
        metadata: {
          sourceRecordId: tracking.sourceRecordId,
        },
      });

      await this.auditService.logFromTracking({
        action: TiramisAuditAction.BUSINESS_RECORD_SYNC_FAILED,
        tracking: failedTracking || tracking,
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

  private buildSyncMatchCondition(
    tableName: string,
    idColumn: string,
    tracking: TiramisSubmissionTrackingEntity,
    startIndex: number,
  ): {
    whereClause: string;
    parameters: any[];
  } {
    if (tableName !== 'tiramis_business_records') {
      return {
        whereClause: `${this.quoteIdentifier(idColumn)} = $${startIndex}`,
        parameters: [tracking.sourceRecordId],
      };
    }

    const sourceModuleColumn = this.quoteIdentifier('source_module');
    const requestTypeColumn = this.quoteIdentifier('request_type');
    const businessReferenceColumn = this.quoteIdentifier('business_reference');
    const parameters: any[] = [
      tracking.sourceModule,
      tracking.requestType,
      tracking.sourceRecordId,
    ];

    const baseCondition = [
      `${sourceModuleColumn} = $${startIndex}`,
      `${requestTypeColumn} = $${startIndex + 1}`,
    ];

    if (this.isUuid(tracking.sourceRecordId)) {
      return {
        whereClause: [
          ...baseCondition,
          `(${this.quoteIdentifier(idColumn)} = $${startIndex + 2} OR ${businessReferenceColumn} = $${startIndex + 2})`,
        ].join(' AND '),
        parameters,
      };
    }

    return {
      whereClause: [
        ...baseCondition,
        `${businessReferenceColumn} = $${startIndex + 2}`,
      ].join(' AND '),
      parameters,
    };
  }

  private isUuid(value?: string | null): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      String(value || ''),
    );
  }

  isFinalStatus(status: string) {
    return [
      TiramisSubmissionStatus.FINAL_SUCCESS,
      TiramisSubmissionStatus.FINAL_FAILED,
      TiramisSubmissionStatus.ACK_FAILED,
      TiramisSubmissionStatus.FAILED,
      TiramisSubmissionStatus.RETRY_EXHAUSTED,
      TiramisSubmissionStatus.CALLBACK_OVERDUE,
    ].includes(status as TiramisSubmissionStatus);
  }

  private async syncReinsuranceOutcomeIfNeeded(
    tracking: TiramisSubmissionTrackingEntity,
  ) {
    if (
      tracking.requestType !== TiramisRequestType.REINSURANCE ||
      !tracking.sourceRecordId
    ) {
      return;
    }

    const declarationStatus =
      tracking.status === TiramisSubmissionStatus.FINAL_SUCCESS
        ? 'ACCEPTED'
        : [
              TiramisSubmissionStatus.FINAL_FAILED,
              TiramisSubmissionStatus.FAILED,
              TiramisSubmissionStatus.ACK_FAILED,
              TiramisSubmissionStatus.RETRY_EXHAUSTED,
            ].includes(tracking.status)
          ? 'FAILED'
          : null;

    if (!declarationStatus) {
      return;
    }

    await this.dataSource.query(
      `
        UPDATE reinsurance_declarations
        SET status = $2, updated_at = now()
        WHERE id = $1
      `,
      [tracking.sourceRecordId, declarationStatus],
    );

    if (declarationStatus === 'ACCEPTED') {
      await this.dataSource.query(
        `
          UPDATE policy_cessions
          SET status = 'DECLARED', updated_at = now()
          WHERE id = (
            SELECT cession_id
            FROM reinsurance_declarations
            WHERE id = $1
          )
        `,
        [tracking.sourceRecordId],
      );
    }
  }
}
