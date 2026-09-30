import { Injectable, Logger } from '@nestjs/common';
import { ClaimRegulatoryOperationType } from '@insurance-max/contracts';
import { DataSource, EntityManager } from 'typeorm';

import { TiramisSubmissionTrackingEntity } from '../../../tiramis/entities/tiramis-submission-tracking.entity';
import { TiramisRequestType } from '../../../tiramis/enums/tiramis-request-type.enum';
import { TiramisSubmissionStatus } from '../../../tiramis/enums/tiramis-submission-status.enum';
import { NotificationsService } from '../../work-items/notifications.service';
import { InsuranceClaim } from '../entities/claim.entity';
import { ClaimIntimation } from '../entities/claim-intimation.entity';
import { ClaimRegulatoryOperation } from '../entities/claim-regulatory-operation.entity';
import {
  ClaimEventActorType,
  ClaimIntimationStatus,
  ClaimRegulatoryStatus,
  ClaimStatus,
} from '../enums/claim.enums';
import { ClaimSettlementService } from './claim-settlement.service';
import { ClaimStateMachineService } from './claim-state-machine.service';

const OPERATION_BY_REQUEST_TYPE: Partial<
  Record<TiramisRequestType, ClaimRegulatoryOperationType>
> = {
  [TiramisRequestType.CLAIM_NOTIFICATION]:
    ClaimRegulatoryOperationType.NOTIFICATION,
  [TiramisRequestType.CLAIM_INTIMATION]:
    ClaimRegulatoryOperationType.INTIMATION,
  [TiramisRequestType.CLAIM_ASSESSMENT]:
    ClaimRegulatoryOperationType.ASSESSMENT,
  [TiramisRequestType.DISCHARGE_VOUCHER]:
    ClaimRegulatoryOperationType.DISCHARGE_VOUCHER,
  [TiramisRequestType.CLAIM_PAYMENT]: ClaimRegulatoryOperationType.PAYMENT,
  [TiramisRequestType.CLAIM_REJECTION]: ClaimRegulatoryOperationType.REJECTION,
};

const FINAL_REGULATORY_STATUSES = [
  ClaimRegulatoryStatus.ACCEPTED,
  ClaimRegulatoryStatus.REJECTED,
  ClaimRegulatoryStatus.FAILED,
];

/**
 * Applies TIRAMIS outcomes (webhook or status polling, both funnelled
 * through TiramisBusinessRecordSyncService) to the claim workflow.
 *
 * Idempotent: an outcome already applied to an operation is ignored, an
 * accepted operation never regresses, and the TIRA claim reference is
 * written once. Claim status only moves on a final TIRA response.
 */
@Injectable()
export class ClaimTiramisOutcomeService {
  private readonly logger = new Logger(ClaimTiramisOutcomeService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly stateMachine: ClaimStateMachineService,
    private readonly settlementService: ClaimSettlementService,
    private readonly notificationsService: NotificationsService,
  ) {}

  isClaimTracking(tracking: TiramisSubmissionTrackingEntity): boolean {
    return (
      String(tracking.sourceModule || '').toLowerCase() === 'claims' &&
      !!OPERATION_BY_REQUEST_TYPE[tracking.requestType]
    );
  }

  async applyFromTracking(tracking: TiramisSubmissionTrackingEntity) {
    const operationType = OPERATION_BY_REQUEST_TYPE[tracking.requestType];

    if (!operationType || !tracking.sourceRecordId) {
      return { applied: false, reason: 'not_a_claim_submission' };
    }

    const nextStatus = this.mapStatus(tracking.status);

    if (!nextStatus) {
      return { applied: false, reason: 'no_regulatory_change' };
    }

    const result = await this.dataSource.transaction(async (manager) => {
      const operation = await manager
        .getRepository(ClaimRegulatoryOperation)
        .createQueryBuilder('operation')
        .setLock('pessimistic_write')
        .where('operation.operation_type = :operationType', { operationType })
        .andWhere('operation.source_record_id = :sourceRecordId', {
          sourceRecordId: tracking.sourceRecordId,
        })
        .getOne();

      if (!operation) {
        return { applied: false, reason: 'operation_not_found' } as const;
      }

      if (
        operation.status === ClaimRegulatoryStatus.ACCEPTED ||
        (FINAL_REGULATORY_STATUSES.includes(operation.status) &&
          operation.tiramis_tracking_id === tracking.id &&
          operation.final_response_code ===
            (tracking.finalResponseStatusCode ?? null))
      ) {
        return { applied: false, reason: 'already_applied' } as const;
      }

      operation.status = nextStatus;
      operation.tiramis_tracking_id = tracking.id;
      operation.tiramis_transaction_id = tracking.tiramisTransactionId ?? null;
      operation.tiramis_request_id = tracking.tiramisRequestId ?? null;
      operation.acknowledgement_code =
        tracking.acknowledgementStatusCode ?? operation.acknowledgement_code;
      operation.acknowledgement_message =
        tracking.acknowledgementStatusDesc ??
        operation.acknowledgement_message;
      operation.acknowledged_at =
        operation.acknowledged_at ?? tracking.acknowledgedAt ?? null;
      operation.final_response_code = tracking.finalResponseStatusCode ?? null;
      operation.final_response_message =
        tracking.finalResponseStatusDesc ?? tracking.lastErrorMessage ?? null;

      if (FINAL_REGULATORY_STATUSES.includes(nextStatus)) {
        operation.completed_at = new Date();
        operation.response_snapshot =
          (tracking.finalResponsePayload as Record<string, unknown>) ?? null;
      }

      const claim = await manager
        .getRepository(InsuranceClaim)
        .createQueryBuilder('claim')
        .setLock('pessimistic_write')
        .where('claim.id = :id', { id: operation.claim_id })
        .getOneOrFail();

      if (nextStatus === ClaimRegulatoryStatus.ACCEPTED) {
        await this.applyAccepted(manager, claim, operation, tracking);
      } else if (
        nextStatus === ClaimRegulatoryStatus.REJECTED ||
        nextStatus === ClaimRegulatoryStatus.FAILED
      ) {
        await this.applyFailed(manager, claim, operation, tracking);
      } else if (nextStatus === ClaimRegulatoryStatus.RECONCILIATION_REQUIRED) {
        await this.stateMachine.recordEvent(manager, claim, {
          eventType: 'TIRAMIS_CALLBACK_OVERDUE',
          summary: `No final TIRA response yet for ${operation.source_record_number}`,
          actorType: ClaimEventActorType.SYSTEM,
          subjectType: operation.operation_type,
          subjectId: operation.source_record_id,
          sourceEventId: `tira:${tracking.id}:overdue`,
        });
      }

      await manager.getRepository(ClaimRegulatoryOperation).save(operation);

      return {
        applied: true,
        status: nextStatus,
        claim,
        operation,
      } as const;
    });

    if (result.applied && result.status !== ClaimRegulatoryStatus.ACCEPTED) {
      await this.notifyFailure(result.claim, result.operation);
    }

    if (
      result.applied &&
      result.status === ClaimRegulatoryStatus.ACCEPTED &&
      result.operation.operation_type === ClaimRegulatoryOperationType.PAYMENT
    ) {
      await this.settlementService.settleIfComplete(result.claim.id);
    }

    return { applied: result.applied, reason: (result as any).reason };
  }

  private async applyAccepted(
    manager: EntityManager,
    claim: InsuranceClaim,
    operation: ClaimRegulatoryOperation,
    tracking: TiramisSubmissionTrackingEntity,
  ) {
    const sourceEventId = `tira:${tracking.id}:accepted`;
    const common = {
      actorType: ClaimEventActorType.TIRA,
      subjectType: operation.operation_type,
      subjectId: operation.source_record_id,
      sourceEventId,
    };

    switch (operation.operation_type) {
      case ClaimRegulatoryOperationType.NOTIFICATION: {
        const reference = this.extractClaimReference(tracking);

        if (!reference) {
          operation.status = ClaimRegulatoryStatus.RECONCILIATION_REQUIRED;
          await this.stateMachine.recordEvent(manager, claim, {
            ...common,
            eventType: 'TIRAMIS_RECONCILIATION_REQUIRED',
            summary:
              'TIRA accepted the notification but returned no ClaimReferenceNumber',
          });
          return;
        }

        if (
          claim.claim_reference_number &&
          claim.claim_reference_number !== reference
        ) {
          operation.status = ClaimRegulatoryStatus.RECONCILIATION_REQUIRED;
          await this.stateMachine.recordEvent(manager, claim, {
            ...common,
            eventType: 'TIRAMIS_RECONCILIATION_REQUIRED',
            summary: `TIRA returned claim reference ${reference} but the claim already holds ${claim.claim_reference_number}`,
          });
          return;
        }

        operation.regulatory_reference = reference;
        await manager.getRepository(InsuranceClaim).update(
          { id: claim.id },
          {
            claim_reference_number: reference,
            tiramis_reference_locked: true,
          },
        );
        claim.claim_reference_number = reference;
        claim.tiramis_reference_locked = true;

        await this.stateMachine.transitionIfIn(
          manager,
          claim,
          [ClaimStatus.NOTIFICATION_SUBMITTED, ClaimStatus.NOTIFICATION_FAILED],
          ClaimStatus.NOTIFICATION_ACCEPTED,
          {
            ...common,
            eventType: 'TIRAMIS_ACCEPTED',
            summary: `TIRA accepted the claim notification; claim reference ${reference}`,
          },
        );
        return;
      }

      case ClaimRegulatoryOperationType.INTIMATION: {
        await manager.getRepository(ClaimIntimation).update(
          { id: operation.source_record_id },
          { status: ClaimIntimationStatus.ACCEPTED },
        );
        const moved = await this.stateMachine.transitionIfIn(
          manager,
          claim,
          [ClaimStatus.INTIMATION_SUBMITTED, ClaimStatus.INTIMATION_FAILED],
          ClaimStatus.INTIMATED,
          {
            ...common,
            eventType: 'TIRAMIS_ACCEPTED',
            summary: `TIRA accepted claim intimation ${operation.source_record_number}`,
          },
        );

        if (!moved) {
          await this.acceptedEvent(manager, claim, operation, common);
        }
        return;
      }

      default:
        await this.acceptedEvent(manager, claim, operation, common);
    }
  }

  private async applyFailed(
    manager: EntityManager,
    claim: InsuranceClaim,
    operation: ClaimRegulatoryOperation,
    tracking: TiramisSubmissionTrackingEntity,
  ) {
    const reason =
      [tracking.finalResponseStatusCode, tracking.finalResponseStatusDesc]
        .filter(Boolean)
        .join(' ') ||
      tracking.lastErrorMessage ||
      tracking.status;
    const common = {
      eventType: 'TIRAMIS_FAILED',
      actorType: ClaimEventActorType.TIRA,
      subjectType: operation.operation_type,
      subjectId: operation.source_record_id,
      sourceEventId: `tira:${tracking.id}:failed:${tracking.finalResponseId ?? tracking.status}`,
      summary: `TIRA rejected ${operation.source_record_number}: ${reason}`,
    };

    if (operation.operation_type === ClaimRegulatoryOperationType.NOTIFICATION) {
      const moved = await this.stateMachine.transitionIfIn(
        manager,
        claim,
        [ClaimStatus.NOTIFICATION_SUBMITTED],
        ClaimStatus.NOTIFICATION_FAILED,
        common,
      );

      if (moved) {
        return;
      }
    }

    if (operation.operation_type === ClaimRegulatoryOperationType.INTIMATION) {
      await manager.getRepository(ClaimIntimation).update(
        { id: operation.source_record_id },
        { status: ClaimIntimationStatus.FAILED },
      );
      const moved = await this.stateMachine.transitionIfIn(
        manager,
        claim,
        [ClaimStatus.INTIMATION_SUBMITTED],
        ClaimStatus.INTIMATION_FAILED,
        common,
      );

      if (moved) {
        return;
      }
    }

    await this.stateMachine.recordEvent(manager, claim, common);
  }

  private acceptedEvent(
    manager: EntityManager,
    claim: InsuranceClaim,
    operation: ClaimRegulatoryOperation,
    common: Record<string, any>,
  ) {
    return this.stateMachine.recordEvent(manager, claim, {
      ...common,
      eventType: 'TIRAMIS_ACCEPTED',
      summary: `TIRA accepted ${operation.source_record_number}`,
    });
  }

  private async notifyFailure(
    claim: InsuranceClaim,
    operation: ClaimRegulatoryOperation,
  ) {
    const recipient = claim.assigned_user_id ?? claim.reported_by_user_id;

    if (!recipient) {
      return;
    }

    try {
      await this.notificationsService.create({
        companyId: claim.company_id,
        branchId: claim.branch_id,
        recipientUserId: recipient,
        type: 'CLAIM_TIRAMIS_FAILED',
        severity: 'HIGH',
        title: `TIRAMIS issue on claim ${claim.claim_no}`,
        message: `${operation.source_record_number}: ${
          operation.final_response_message ?? operation.status
        }`,
        resourceType: 'claim',
        resourceId: claim.id,
        actionUrl: `/claims/${claim.id}`,
      });
    } catch (error: any) {
      this.logger.warn(
        `Could not notify claim ${claim.claim_no} TIRAMIS failure: ${error?.message}`,
      );
    }
  }

  private mapStatus(
    status: TiramisSubmissionStatus,
  ): ClaimRegulatoryStatus | null {
    switch (status) {
      case TiramisSubmissionStatus.FINAL_SUCCESS:
        return ClaimRegulatoryStatus.ACCEPTED;
      case TiramisSubmissionStatus.FINAL_FAILED:
        return ClaimRegulatoryStatus.REJECTED;
      case TiramisSubmissionStatus.ACK_FAILED:
      case TiramisSubmissionStatus.FAILED:
      case TiramisSubmissionStatus.RETRY_EXHAUSTED:
        return ClaimRegulatoryStatus.FAILED;
      case TiramisSubmissionStatus.RETRY_PENDING:
      case TiramisSubmissionStatus.RETRYING:
        return ClaimRegulatoryStatus.RETRYABLE;
      case TiramisSubmissionStatus.ACK_ACCEPTED:
      case TiramisSubmissionStatus.ACKNOWLEDGED:
      case TiramisSubmissionStatus.PENDING_FINAL:
        return ClaimRegulatoryStatus.ACKNOWLEDGED;
      case TiramisSubmissionStatus.CALLBACK_OVERDUE:
        return ClaimRegulatoryStatus.RECONCILIATION_REQUIRED;
      case TiramisSubmissionStatus.PENDING:
      case TiramisSubmissionStatus.SUBMITTING:
      case TiramisSubmissionStatus.SENT_TO_TIRAMIS_SERVICE:
        return ClaimRegulatoryStatus.PROCESSING;
      default:
        return null;
    }
  }

  /**
   * The reference arrives on the portal webhook event, in the regulatory
   * response, or only inside the raw TIRA XML (status polling path).
   */
  extractClaimReference(
    tracking: Pick<
      TiramisSubmissionTrackingEntity,
      'finalResponsePayload' | 'tiramisResponsePayload'
    >,
  ): string | null {
    const sources = [tracking.finalResponsePayload, tracking.tiramisResponsePayload];

    for (const source of sources) {
      const found = this.findReference(source, 0);

      if (found) {
        return found;
      }
    }

    return null;
  }

  private findReference(value: unknown, depth: number): string | null {
    if (value == null || depth > 6) {
      return null;
    }

    if (typeof value === 'string') {
      const match = /<ClaimReferenceNumber>\s*([^<\s][^<]*?)\s*<\/ClaimReferenceNumber>/.exec(
        value,
      );
      return match?.[1] ?? null;
    }

    if (typeof value !== 'object') {
      return null;
    }

    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (
        /^claimReferenceNumber$/i.test(key) &&
        typeof child === 'string' &&
        child.trim()
      ) {
        return child.trim();
      }
    }

    for (const child of Object.values(value as Record<string, unknown>)) {
      const found = this.findReference(child, depth + 1);

      if (found) {
        return found;
      }
    }

    return null;
  }
}
