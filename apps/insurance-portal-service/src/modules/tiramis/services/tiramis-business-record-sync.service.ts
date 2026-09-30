import { Injectable, Logger, Optional } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { PolicyTransactionType } from '@insurance-max/contracts';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { XMLParser } from 'fast-xml-parser';

import { resolveTiramisBusinessRecordMapping } from '../constants/tiramis-business-record-map.constant';
import { TiramisAuditAction } from '../enums/tiramis-audit-action.enum';
import { TiramisSubmissionTrackingEntity } from '../entities/tiramis-submission-tracking.entity';
import { TiramisRequestType } from '../enums/tiramis-request-type.enum';
import { TiramisSubmissionStatus } from '../enums/tiramis-submission-status.enum';
import { TiramisSubmissionTrackingRepository } from '../repositories/tiramis-submission-tracking.repository';
import { TiramisAuditService } from './tiramis-audit.service';
import { TiramisNotificationService } from './tiramis-notification.service';
import { IssuanceService } from '../../tenant/issuance/issuance.service';
import { PolicyTransaction } from '../../tenant/policy-transactions/entities/policy-transaction.entity';
import { ClaimTiramisOutcomeService } from '../../tenant/claims/services/claim-tiramis-outcome.service';
import { PolicyTransactionApplyService } from '../../tenant/policy-transactions/services/policy-transaction-apply.service';
import { PolicyTransactionLifecycleService } from '../../tenant/policy-transactions/services/policy-transaction-lifecycle.service';
import { PolicyTransactionRegulatoryOutcomeService } from '../../tenant/policy-transactions/services/policy-transaction-regulatory-outcome.service';
import { PortalTiraSubmission } from '../../tenant/tiramis-integration/entities/portal-tira-submission.entity';
import { PortalTiraSubmissionStatus } from '../../tenant/tiramis-integration/enums/portal-tira-submission-status.enum';
import type { TiramisNotificationEventDto } from '../../tenant/tiramis-integration/dto/tiramis-notification-event.dto';

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
    private readonly issuanceService: IssuanceService,
    @InjectRepository(PortalTiraSubmission)
    private readonly portalSubmissionRepository: Repository<PortalTiraSubmission>,
    @Optional()
    private readonly moduleRef?: ModuleRef,
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

    if (this.isPolicyTransactionSource(tracking.sourceModule)) {
      return this.syncPolicyTransactionOutcomeIfNeeded(tracking);
    }

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
      await this.syncClaimOutcomeIfNeeded(tracking);

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

  private isPolicyTransactionSource(sourceModule?: string | null) {
    return ['policy-transactions', 'policy-transaction'].includes(
      String(sourceModule || '')
        .trim()
        .toLowerCase()
        .replace(/_/g, '-'),
    );
  }

  private async syncPolicyTransactionOutcomeIfNeeded(
    tracking: TiramisSubmissionTrackingEntity,
  ) {
    if (!tracking.sourceCompanyId || !tracking.sourceRecordId) {
      return {
        synced: false,
        reason: 'policy_transaction_reference_missing',
      };
    }

    const transaction = await this.dataSource
      .getRepository(PolicyTransaction)
      .findOne({
        where: {
          id: tracking.sourceRecordId,
          company_id: tracking.sourceCompanyId,
        },
      });

    if (!transaction) {
      return {
        synced: false,
        reason: 'policy_transaction_not_found',
        sourceRecordId: tracking.sourceRecordId,
      };
    }

    const terminalOutcome =
      this.resolvePolicyTransactionTerminalOutcome(tracking);

    if (!terminalOutcome) {
      return {
        synced: false,
        reason: 'policy_transaction_not_terminal',
        sourceRecordId: tracking.sourceRecordId,
        status: tracking.status,
      };
    }

    const lifecycleService = this.resolvePolicyTransactionLifecycleService();
    const context = {
      changedBy: null,
      reason:
        tracking.finalResponseStatusDesc ||
        tracking.acknowledgementStatusDesc ||
        tracking.lastErrorMessage ||
        null,
      tiraRequestId: tracking.tiramisRequestId || null,
      tiraResponseId: tracking.finalResponseId || null,
      requestId: tracking.id,
    };

    if (terminalOutcome === 'FAILED') {
      await lifecycleService.markSubmissionFailed(
        tracking.sourceCompanyId,
        transaction.id,
        context,
      );
      await this.trackingRepository.markBusinessRecordSynced(tracking.id);

      return {
        synced: true,
        tableName: 'policy_transactions',
        sourceRecordId: transaction.id,
        status: tracking.status,
        outcome: terminalOutcome,
      };
    }

    const regulatoryResponse = this.extractRegulatoryResponse(tracking);
    const submission = await this.findOrCreatePortalSubmission(tracking);
    await this.refreshPortalSubmissionFromTracking(
      submission,
      tracking,
      regulatoryResponse,
    );

    const payload = this.buildFinalSuccessPayload(tracking, regulatoryResponse);
    const captured =
      await this.resolvePolicyTransactionRegulatoryOutcomeService().captureFinalSuccess(
        tracking.sourceCompanyId,
        transaction.id,
        submission,
        payload,
        tracking,
      );

    await lifecycleService.markSubmissionAccepted(
      tracking.sourceCompanyId,
      transaction.id,
      context,
    );

    const applyService = this.resolvePolicyTransactionApplyService();
    if (
      captured.transaction.transaction_type ===
      PolicyTransactionType.ENDORSEMENT
    ) {
      await applyService.applyEndorsement(
        tracking.sourceCompanyId,
        transaction.id,
      );
    } else if (
      captured.transaction.transaction_type ===
      PolicyTransactionType.CANCELLATION
    ) {
      await applyService.applyCancellation(
        tracking.sourceCompanyId,
        transaction.id,
      );
    }

    await this.trackingRepository.markBusinessRecordSynced(tracking.id);

    await this.auditService.logFromTracking({
      action: TiramisAuditAction.BUSINESS_RECORD_SYNC_SUCCESS,
      tracking,
      success: true,
      metadata: {
        tableName: 'policy_transactions',
        sourceRecordId: transaction.id,
        outcome: terminalOutcome,
      },
    });

    await this.notificationService.notifyBusinessRecordSyncSuccess({
      tracking,
      metadata: {
        tableName: 'policy_transactions',
        sourceRecordId: transaction.id,
        outcome: terminalOutcome,
      },
    });

    return {
      synced: true,
      tableName: 'policy_transactions',
      sourceRecordId: transaction.id,
      status: tracking.status,
      outcome: terminalOutcome,
    };
  }

  private resolvePolicyTransactionTerminalOutcome(
    tracking: TiramisSubmissionTrackingEntity,
  ): 'SUCCESS' | 'FAILED' | null {
    if (tracking.status === TiramisSubmissionStatus.FINAL_SUCCESS) {
      return 'SUCCESS';
    }

    if (
      [
        TiramisSubmissionStatus.FINAL_FAILED,
        TiramisSubmissionStatus.ACK_FAILED,
        TiramisSubmissionStatus.FAILED,
        TiramisSubmissionStatus.RETRY_EXHAUSTED,
      ].includes(tracking.status)
    ) {
      return 'FAILED';
    }

    return null;
  }

  private resolvePolicyTransactionLifecycleService() {
    return this.getPolicyTransactionProvider(PolicyTransactionLifecycleService);
  }

  private resolvePolicyTransactionApplyService() {
    return this.getPolicyTransactionProvider(PolicyTransactionApplyService);
  }

  private resolvePolicyTransactionRegulatoryOutcomeService() {
    return this.getPolicyTransactionProvider(
      PolicyTransactionRegulatoryOutcomeService,
    );
  }

  private getPolicyTransactionProvider<T>(token: new (...args: any[]) => T): T {
    if (!this.moduleRef) {
      throw new Error('Policy transaction sync providers are unavailable.');
    }

    return this.moduleRef.get(token, { strict: false });
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
    ].includes(status as TiramisSubmissionStatus);
  }

/**
   * Claim stages advance only from the final TIRA outcome; the claims module
   * owns that logic. Resolved lazily because ClaimsModule imports this
   * module.
   */
  private async syncClaimOutcomeIfNeeded(
    tracking: TiramisSubmissionTrackingEntity,
  ) {
    if (String(tracking.sourceModule || '').toLowerCase() !== 'claims') {
      return;
    }

    try {
      const outcome = this.getPolicyTransactionProvider(ClaimTiramisOutcomeService);
      await outcome.applyFromTracking(tracking);
    } catch (error: any) {
      this.logger.warn(
        `Claim outcome for tracking ${tracking.id} not applied: ${error?.message || error}`,
      );
      throw error;
    }
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

    const alreadyAtTargetStatus =
      quotation.quotation_status === terminalOutcome.quotationStatus &&
      quotation.tira_status === terminalOutcome.tiraStatus;

    // Skip entirely (no workflow_revision/state_version/updated_at bump) when
    // this call would be a pure no-op repeat — otherwise workflow_revision
    // keeps incrementing on every redundant sync (cron re-poll, retry,
    // manual resync), and createOrReuseIssuedPolicy's reuse lookup keys off
    // that exact revision, so a repeat call would fail to find the policy it
    // already issued and create a duplicate instead of reusing it.
    if (!alreadyAtTargetStatus) {
      await this.dataSource.transaction(async (manager) => {
        await manager.query(
          `
            UPDATE quotations
            SET
              quotation_status = $2,
              tira_status = $3,
              tira_request_id = COALESCE($4, tira_request_id),
              tira_response_id = COALESCE($5, tira_response_id),
              tira_response_code = COALESCE($6, tira_response_code),
              tira_response_description = COALESCE($7, tira_response_description),
              tira_error_details = $8::jsonb,
              submission_status_v2 = $9,
              quotation_stage = CASE
                WHEN $2::varchar = 'CANCELLED' THEN 'CANCELLED'
                WHEN $2::varchar IN ('COMPLETED', 'FAILED') THEN 'COMPLETED'
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
                AND tira_status IN ('SUCCESS', 'ENDORSED', 'CANCELLED')
                AND $3::varchar NOT IN ('SUCCESS', 'ENDORSED', 'CANCELLED')
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
      });
    }

    // The webhook-driven path (TiramisIntegrationService.handleTiramisNotification)
    // calls IssuanceService directly. This raw-SQL sync path is the OTHER way a
    // quotation can reach COMPLETED/SUCCESS (cron polling, retries, manual
    // resync) and previously had no equivalent call, so quotations processed
    // here never got a cover note or policy. Must run after the transaction
    // above commits, since issuance re-reads the quotation's committed status.
    if (
      terminalOutcome.quotationStatus === 'COMPLETED' &&
      terminalOutcome.tiraStatus === 'SUCCESS'
    ) {
      await this.triggerPolicyIssuanceIfNeeded(tracking, regulatoryResponse);
    }
  }

  private async triggerPolicyIssuanceIfNeeded(
    tracking: TiramisSubmissionTrackingEntity,
    regulatoryResponse: Record<string, any> | null,
  ) {
    if (!tracking.quotationId && !tracking.sourceRecordId) {
      return;
    }

    try {
      const submission = await this.findOrCreatePortalSubmission(tracking);
      const coverNote = regulatoryResponse?.coverNotes?.[0];
      await this.refreshPortalSubmissionFromTracking(
        submission,
        tracking,
        regulatoryResponse,
      );

      if (
        coverNote &&
        (coverNote.coverNoteReferenceNumber || coverNote.stickerNumber)
      ) {
        submission.cover_note_reference_number =
          coverNote.coverNoteReferenceNumber ||
          submission.cover_note_reference_number;
        submission.sticker_number =
          coverNote.stickerNumber || submission.sticker_number;
        await this.portalSubmissionRepository.save(submission);
      }

      const payload = this.buildFinalSuccessPayload(
        tracking,
        regulatoryResponse,
      );

      const result = await this.issuanceService.applyNotification(
        submission,
        payload,
      );

      if (result?.policy) {
        this.logger.log(
          `Issued policy ${result.policy.id} for quotation ${
            tracking.quotationId || tracking.sourceRecordId
          } via status-sync path (tracking ${tracking.id})`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Failed to trigger policy issuance from status sync for tracking ${tracking.id}: ${
          error instanceof Error ? error.message : error
        }`,
      );
    }
  }

  private async findOrCreatePortalSubmission(
    tracking: TiramisSubmissionTrackingEntity,
  ): Promise<PortalTiraSubmission> {
    const existing = await this.findExistingPortalSubmission(tracking);

    if (existing) {
      return existing;
    }

    const quotationId =
      tracking.quotationId ||
      (this.isQuotationSource(tracking.sourceModule)
        ? tracking.sourceRecordId
        : null);

    const submission = this.portalSubmissionRepository.create({
      company_id: tracking.sourceCompanyId!,
      quotation_id: quotationId,
      source_module: tracking.sourceModule,
      source_record_id: tracking.sourceRecordId,
      business_reference: tracking.businessReference,
      request_type: tracking.requestType,
      service_type: tracking.tiramisServiceType,
      root_element: tracking.tiramisRootElement,
      tiramis_transaction_id: tracking.tiramisTransactionId,
      tiramis_request_id: tracking.tiramisRequestId,
      tiramis_response_id: tracking.finalResponseId,
      status: PortalTiraSubmissionStatus.FINAL_SUCCESS,
      status_code: tracking.finalResponseStatusCode,
      status_description: tracking.finalResponseStatusDesc,
      last_error: tracking.lastErrorMessage,
      last_payload:
        (tracking.finalResponsePayload as Record<string, unknown>) ||
        (tracking.tiramisResponsePayload as Record<string, unknown>) ||
        null,
      submitted_at: tracking.submittedAt || tracking.createdAt,
      last_event_at: new Date(),
      completed_at: tracking.finalResponseReceivedAt || new Date(),
    });

    return this.portalSubmissionRepository.save(submission);
  }

  private async refreshPortalSubmissionFromTracking(
    submission: PortalTiraSubmission,
    tracking: TiramisSubmissionTrackingEntity,
    regulatoryResponse: Record<string, any> | null,
  ) {
    const coverNote = regulatoryResponse?.coverNotes?.[0];

    submission.company_id = tracking.sourceCompanyId || submission.company_id;
    submission.policy_id = tracking.policyId || submission.policy_id;
    submission.source_module =
      tracking.sourceModule || submission.source_module;
    submission.source_record_id =
      tracking.sourceRecordId || submission.source_record_id;
    submission.business_reference =
      tracking.businessReference || submission.business_reference;
    submission.request_type = tracking.requestType || submission.request_type;
    submission.service_type =
      tracking.tiramisServiceType || submission.service_type;
    submission.root_element =
      tracking.tiramisRootElement || submission.root_element;
    submission.tiramis_transaction_id =
      tracking.tiramisTransactionId || submission.tiramis_transaction_id;
    submission.tiramis_request_id =
      tracking.tiramisRequestId || submission.tiramis_request_id;
    submission.tiramis_response_id =
      tracking.finalResponseId || submission.tiramis_response_id;
    submission.status = this.toPortalSubmissionStatus(tracking.status);
    submission.status_code =
      tracking.finalResponseStatusCode ||
      tracking.acknowledgementStatusCode ||
      submission.status_code;
    submission.status_description =
      tracking.finalResponseStatusDesc ||
      tracking.acknowledgementStatusDesc ||
      submission.status_description;
    submission.cover_note_reference_number =
      coverNote?.coverNoteReferenceNumber ||
      submission.cover_note_reference_number;
    submission.policy_reference_number =
      regulatoryResponse?.policy?.policyReferenceNumber ||
      submission.policy_reference_number;
    submission.sticker_number =
      coverNote?.stickerNumber || submission.sticker_number;
    submission.last_error = tracking.lastErrorMessage || submission.last_error;
    submission.last_payload =
      (tracking.finalResponsePayload as Record<string, unknown>) ||
      (tracking.tiramisResponsePayload as Record<string, unknown>) ||
      submission.last_payload;
    submission.submitted_at = tracking.submittedAt || submission.submitted_at;
    submission.last_event_at =
      tracking.finalResponseReceivedAt ||
      tracking.acknowledgedAt ||
      submission.last_event_at ||
      new Date();
    submission.completed_at =
      tracking.finalResponseReceivedAt || submission.completed_at;

    await this.portalSubmissionRepository.save(submission);
  }

  private buildFinalSuccessPayload(
    tracking: TiramisSubmissionTrackingEntity,
    regulatoryResponse: Record<string, any> | null,
  ): TiramisNotificationEventDto {
    const receivedAt = (
      tracking.finalResponseReceivedAt || new Date()
    ).toISOString();

    return {
      eventType: 'TIRAMIS_FINAL_SUCCESS',
      sourceService: tracking.sourceModule,
      sourceCompanyId: tracking.sourceCompanyId,
      sourceModule: tracking.sourceModule,
      sourceRecordId: tracking.sourceRecordId,
      businessReference: tracking.businessReference,
      tiramisTransactionId: tracking.tiramisTransactionId,
      requestId: tracking.tiramisRequestId || tracking.id,
      responseId: tracking.finalResponseId,
      serviceType: tracking.tiramisServiceType,
      rootElement: tracking.tiramisRootElement,
      statusCode: tracking.finalResponseStatusCode,
      statusDescription: tracking.finalResponseStatusDesc,
      regulatoryResponse: {
        transactionId: tracking.tiramisTransactionId || '',
        requestId: tracking.tiramisRequestId || tracking.id,
        responseId: tracking.finalResponseId || '',
        requestType: tracking.requestType,
        responseRoot: tracking.tiramisRootElement || '',
        success: true,
        statusCode: tracking.finalResponseStatusCode || '',
        statusDescription: tracking.finalResponseStatusDesc || '',
        coverNotes: regulatoryResponse?.coverNotes ?? [],
        policy: regulatoryResponse?.policy ?? null,
        signatureVerified: false,
        // Deliberately undefined (not ''): issuance falls back to hashing
        // the payload itself when this is absent.
        responsePayloadHash: undefined as unknown as string,
        receivedAt,
      },
      errorMessage: tracking.lastErrorMessage,
      occurredAt: receivedAt,
    };
  }

  private toPortalSubmissionStatus(status: TiramisSubmissionStatus) {
    switch (status) {
      case TiramisSubmissionStatus.FINAL_SUCCESS:
        return PortalTiraSubmissionStatus.COMPLETED;
      case TiramisSubmissionStatus.FINAL_FAILED:
        return PortalTiraSubmissionStatus.FINAL_FAILED;
      case TiramisSubmissionStatus.ACK_FAILED:
        return PortalTiraSubmissionStatus.ACK_FAILED;
      case TiramisSubmissionStatus.CALLBACK_OVERDUE:
        return PortalTiraSubmissionStatus.FINAL_CALLBACK_OVERDUE;
      case TiramisSubmissionStatus.FAILED:
      case TiramisSubmissionStatus.RETRY_EXHAUSTED:
        return PortalTiraSubmissionStatus.FAILED;
      case TiramisSubmissionStatus.PENDING_FINAL:
        return PortalTiraSubmissionStatus.WAITING_FINAL_RESPONSE;
      case TiramisSubmissionStatus.ACK_ACCEPTED:
      case TiramisSubmissionStatus.ACKNOWLEDGED:
        return PortalTiraSubmissionStatus.ACK_SUCCESS;
      default:
        return PortalTiraSubmissionStatus.SUBMITTED_TO_TIRAMIS;
    }
  }

  private async findExistingPortalSubmission(
    tracking: TiramisSubmissionTrackingEntity,
  ): Promise<PortalTiraSubmission | null> {
    if (tracking.tiramisTransactionId) {
      const byTransaction = await this.portalSubmissionRepository.findOne({
        where: { tiramis_transaction_id: tracking.tiramisTransactionId },
      });

      if (byTransaction) {
        return byTransaction;
      }
    }

    if (tracking.tiramisRequestId) {
      const byRequest = await this.portalSubmissionRepository.findOne({
        where: { tiramis_request_id: tracking.tiramisRequestId },
      });

      if (byRequest) {
        return byRequest;
      }
    }

    return null;
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
        quotationStatus: 'COMPLETED',
        tiraStatus: isCancellation ? 'CANCELLED' : 'SUCCESS',
        submissionStatus: 'ACCEPTED',
        transitionType: isCancellation
          ? 'MARK_TIRA_CANCELLED'
          : 'MARK_TIRA_SUCCESSFUL',
      };
    }

    if (
      tracking.acknowledgementStatusCode === 'TIRA001' &&
      [
        TiramisSubmissionStatus.ACK_ACCEPTED,
        TiramisSubmissionStatus.ACKNOWLEDGED,
        TiramisSubmissionStatus.PENDING_FINAL,
        TiramisSubmissionStatus.CALLBACK_OVERDUE,
      ].includes(tracking.status)
    ) {
      return {
        quotationStatus: 'COMPLETED',
        tiraStatus: 'SUBMITTED',
        submissionStatus: 'ACCEPTED',
        transitionType: 'MARK_TIRA_ACKNOWLEDGED',
      };
    }

    if (
      [
        TiramisSubmissionStatus.FINAL_FAILED,
        TiramisSubmissionStatus.ACK_FAILED,
        TiramisSubmissionStatus.FAILED,
        TiramisSubmissionStatus.RETRY_EXHAUSTED,
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
    const attemptPayloads = Array.isArray(
      (tracking.tiramisResponsePayload as any)?.attempts,
    )
      ? (tracking.tiramisResponsePayload as any).attempts
          .map((attempt: any) => attempt?.payloads)
          .filter(Boolean)
      : [];
    const payloads = [
      tracking.finalResponsePayload,
      tracking.tiramisResponsePayload,
      (tracking.tiramisResponsePayload as any)?.finalResponse,
      (tracking.tiramisResponsePayload as any)?.currentAttempt?.finalResponse,
      (tracking.tiramisResponsePayload as any)?.currentAttempt?.payloads,
      ...attemptPayloads,
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
      attemptPayloads
        .map((payload: any) => payload?.responseXml)
        .find((xml: unknown): xml is string => typeof xml === 'string') ||
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
