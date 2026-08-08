import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { XMLParser } from 'fast-xml-parser';

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
  private readonly xmlParser = new XMLParser({
    ignoreAttributes: false,
    trimValues: true,
  });

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

      await this.syncQuotationOutcomeIfNeeded(tracking);
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

  private async syncQuotationOutcomeIfNeeded(
    tracking: TiramisSubmissionTrackingEntity,
  ) {
    if (
      !this.isQuotationSource(tracking.sourceModule) ||
      !tracking.sourceRecordId
    ) {
      return;
    }

    const terminalOutcome = this.resolveQuotationTerminalOutcome(tracking);

    if (!terminalOutcome) {
      return;
    }

    const rows = await this.dataSource.query(
      `
        SELECT
          id,
          quotation_status,
          approval_status,
          payment_status,
          tira_status
        FROM quotations
        WHERE id = $1
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [tracking.sourceRecordId],
    );

    const quotation = rows?.[0];

    if (!quotation) {
      return;
    }

    const regulatoryResponse = this.extractRegulatoryResponse(tracking);
    const statusCode =
      tracking.finalResponseStatusCode ||
      tracking.acknowledgementStatusCode ||
      null;
    const statusDescription =
      tracking.finalResponseStatusDesc ||
      tracking.acknowledgementStatusDesc ||
      tracking.lastErrorMessage ||
      null;
    const tiraRequestId = tracking.tiramisRequestId || null;
    const tiraResponseId = tracking.finalResponseId || null;
    const metadata = {
      source: 'TIRAMIS_STATUS_SYNC',
      trackingId: tracking.id,
      tiramisTransactionId: tracking.tiramisTransactionId || null,
      tiramisStatus: tracking.status,
      statusCode,
      statusDescription,
      regulatoryResponse,
    };

    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `
          UPDATE quotations
          SET
            quotation_status = $2::quotation_status_enum,
            tira_status = $3::tira_status_enum,
            tira_request_id = COALESCE($4, tira_request_id),
            tira_response_id = COALESCE($5, tira_response_id),
            tira_response_code = COALESCE($6, tira_response_code),
            tira_response_description = COALESCE($7, tira_response_description),
            tira_error_details = $8::jsonb,
            submission_status_v2 = $9,
            quotation_stage = CASE
              WHEN $2::quotation_status_enum = 'CANCELLED'::quotation_status_enum THEN 'CANCELLED'
              WHEN $2::quotation_status_enum IN ('COMPLETED'::quotation_status_enum, 'FAILED'::quotation_status_enum) THEN 'COMPLETED'
              ELSE quotation_stage
            END,
            workflow_completed_at = COALESCE(workflow_completed_at, now()),
            workflow_revision = COALESCE(workflow_revision, 0) + 1,
            state_version = COALESCE(state_version, 0) + 1,
            updated_at = now()
          WHERE id = $1
            AND deleted_at IS NULL
            AND NOT (
              quotation_status IN ('COMPLETED', 'CANCELLED')
              AND tira_status = 'SUCCESS'
              AND $3::tira_status_enum <> 'SUCCESS'::tira_status_enum
            )
        `,
        [
          quotation.id,
          terminalOutcome.quotationStatus,
          terminalOutcome.tiraStatus,
          tiraRequestId,
          tiraResponseId,
          statusCode,
          statusDescription,
          JSON.stringify(metadata),
          terminalOutcome.submissionStatus,
        ],
      );

      if (
        quotation.quotation_status !== terminalOutcome.quotationStatus ||
        quotation.tira_status !== terminalOutcome.tiraStatus
      ) {
        await manager.query(
          `
            INSERT INTO quotation_status_history (
              quotation_id,
              previous_quotation_status,
              new_quotation_status,
              previous_approval_status,
              new_approval_status,
              previous_payment_status,
              new_payment_status,
              previous_tira_status,
              new_tira_status,
              transition_type,
              reason,
              changed_by,
              changed_by_type,
              source,
              request_id,
              tira_request_id,
              tira_response_id,
              metadata,
              created_at
            )
            VALUES (
              $1, $2, $3, $4, $4, $5, $5, $6, $7, $8, $9,
              NULL, 'SYSTEM', 'TIRAMIS', $10, $10, $11, $12::jsonb, now()
            )
          `,
          [
            quotation.id,
            quotation.quotation_status,
            terminalOutcome.quotationStatus,
            quotation.approval_status,
            quotation.payment_status,
            quotation.tira_status,
            terminalOutcome.tiraStatus,
            terminalOutcome.transitionType,
            statusDescription,
            tiraRequestId,
            tiraResponseId,
            JSON.stringify(metadata),
          ],
        );
      }
    });
  }

  private isQuotationSource(sourceModule?: string | null) {
    const value = String(sourceModule || '')
      .trim()
      .toLowerCase();

    return [
      'quotation',
      'quotations',
      'tenant.quotations',
      'tenant-quotations',
    ].includes(value);
  }

  private resolveQuotationTerminalOutcome(
    tracking: TiramisSubmissionTrackingEntity,
  ): {
    quotationStatus: string;
    tiraStatus: string;
    submissionStatus: string;
    transitionType: string;
  } | null {
    if (tracking.status === TiramisSubmissionStatus.FINAL_SUCCESS) {
      const statusDescription = String(tracking.finalResponseStatusDesc || '')
        .trim()
        .toLowerCase();
      const isCancellation =
        statusDescription === 'transaction successfully cancelled';

      return {
        quotationStatus: isCancellation ? 'CANCELLED' : 'COMPLETED',
        tiraStatus: 'SUCCESS',
        submissionStatus: 'ACCEPTED',
        transitionType: isCancellation
          ? 'MARK_TIRA_CANCELLED'
          : 'MARK_TIRA_SUCCESSFUL',
      };
    }

    if (
      [
        TiramisSubmissionStatus.FINAL_FAILED,
        TiramisSubmissionStatus.ACK_FAILED,
        TiramisSubmissionStatus.FAILED,
        TiramisSubmissionStatus.RETRY_EXHAUSTED,
        TiramisSubmissionStatus.CALLBACK_OVERDUE,
      ].includes(tracking.status)
    ) {
      return {
        quotationStatus: 'FAILED',
        tiraStatus: 'FAILED',
        submissionStatus: 'FAILED',
        transitionType: 'MARK_TIRA_FAILED',
      };
    }

    return null;
  }

  private extractRegulatoryResponse(
    tracking: TiramisSubmissionTrackingEntity,
  ): Record<string, any> | null {
    const payloads = [
      tracking.finalResponsePayload,
      tracking.tiramisResponsePayload,
      (tracking.tiramisResponsePayload as any)?.finalResponse,
      (tracking.tiramisResponsePayload as any)?.currentAttempt?.finalResponse,
      (tracking.tiramisResponsePayload as any)?.currentAttempt?.payloads,
    ].filter(Boolean);

    for (const payload of payloads) {
      const parsed = this.extractRegulatoryResponseFromObject(payload);

      if (parsed) {
        return parsed;
      }
    }

    const responseXml =
      (tracking.finalResponsePayload as any)?.responseXml ||
      (tracking.tiramisResponsePayload as any)?.responseXml ||
      (tracking.tiramisResponsePayload as any)?.currentAttempt?.payloads
        ?.responseXml ||
      null;

    if (responseXml) {
      return this.extractRegulatoryResponseFromXml(responseXml);
    }

    return null;
  }

  private extractRegulatoryResponseFromObject(
    payload: any,
  ): Record<string, any> | null {
    if (!payload || typeof payload !== 'object') {
      return null;
    }

    if (payload.regulatoryResponse) {
      return payload.regulatoryResponse;
    }

    const coverNoteReferenceNumber =
      payload.coverNoteReferenceNumber ||
      payload.motorCoverNoteReferenceNumber ||
      payload.CoverNoteReferenceNumber ||
      payload.MotorCoverNoteReferenceNumber ||
      payload.coverNote?.coverNoteReferenceNumber ||
      payload.motorCoverNote?.coverNoteReferenceNumber ||
      null;
    const stickerNumber =
      payload.stickerNumber ||
      payload.StickerNumber ||
      payload.coverNote?.stickerNumber ||
      payload.motorCoverNote?.stickerNumber ||
      null;
    const policyReferenceNumber =
      payload.policyReferenceNumber ||
      payload.PolicyReferenceNumber ||
      payload.policy?.policyReferenceNumber ||
      null;

    if (!coverNoteReferenceNumber && !stickerNumber && !policyReferenceNumber) {
      return null;
    }

    return {
      coverNotes:
        coverNoteReferenceNumber || stickerNumber
          ? [
              {
                coverNoteReferenceNumber: coverNoteReferenceNumber || null,
                stickerNumber: stickerNumber || null,
              },
            ]
          : [],
      policy: policyReferenceNumber
        ? {
            policyReferenceNumber,
          }
        : null,
    };
  }

  private extractRegulatoryResponseFromXml(
    xml: string,
  ): Record<string, any> | null {
    try {
      const parsed = this.xmlParser.parse(xml);
      const values = this.flattenXmlValues(parsed);
      const contentResponse =
        values.Content && values.Content.trim().startsWith('<')
          ? this.extractRegulatoryResponseFromXml(values.Content)
          : null;

      if (contentResponse) {
        return contentResponse;
      }

      const coverNoteReferenceNumber =
        values.CoverNoteReferenceNumber ||
        values.MotorCoverNoteReferenceNumber ||
        null;
      const stickerNumber = values.StickerNumber || null;
      const policyReferenceNumber = values.PolicyReferenceNumber || null;

      if (
        !coverNoteReferenceNumber &&
        !stickerNumber &&
        !policyReferenceNumber
      ) {
        return null;
      }

      return {
        coverNotes:
          coverNoteReferenceNumber || stickerNumber
            ? [
                {
                  coverNoteReferenceNumber: coverNoteReferenceNumber || null,
                  stickerNumber: stickerNumber || null,
                },
              ]
            : [],
        policy: policyReferenceNumber
          ? {
              policyReferenceNumber,
            }
          : null,
      };
    } catch (error) {
      this.logger.warn(
        `Failed to parse TIRAMIS final response XML for business sync: ${
          error instanceof Error ? error.message : error
        }`,
      );

      return null;
    }
  }

  private flattenXmlValues(value: any, result: Record<string, string> = {}) {
    if (!value || typeof value !== 'object') {
      return result;
    }

    for (const [key, child] of Object.entries(value)) {
      if (child && typeof child === 'object') {
        this.flattenXmlValues(child, result);
      } else if (child !== null && child !== undefined) {
        result[key] = String(child);
      }
    }

    return result;
  }
}
