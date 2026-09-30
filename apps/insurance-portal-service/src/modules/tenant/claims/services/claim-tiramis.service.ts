import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import {
  ClaimRegulatoryOperationType,
  validateClaimTiramisPayload,
} from '@insurance-max/contracts';
import { ProductDefinitionHashService } from '@insurance-max/shared-kernel';
import { DataSource, EntityManager, Repository } from 'typeorm';

import { TiramisBusinessSubmitService } from '../../../tiramis/services/tiramis-business-submit.service';
import { User } from '../../users/entities/user.entity';
import { InsuranceClaim } from '../entities/claim.entity';
import { ClaimRegulatoryOperation } from '../entities/claim-regulatory-operation.entity';
import {
  ClaimEventActorType,
  ClaimRegulatoryStatus,
  ClaimStatus,
} from '../enums/claim.enums';
import { ClaimStateMachineService } from './claim-state-machine.service';

export type ClaimOperationType = ClaimRegulatoryOperationType;

export interface ClaimSubmissionRequest {
  user: AuthenticatedUser;
  claim: InsuranceClaim;
  operationType: ClaimOperationType;
  sourceRecordId: string;
  sourceRecordNumber: string;
  payload: Record<string, unknown>;
  /** Claim status transition applied before submitting, if any. */
  submittedStatus?: ClaimStatus;
  failedStatus?: ClaimStatus;
  /** True for a user-requested resubmission after a failed attempt. */
  retry?: boolean;
}

/** Operations whose TIRA outcome is already final and must not be resent. */
const LOCKED_REGULATORY_STATUSES = [
  ClaimRegulatoryStatus.ACCEPTED,
  ClaimRegulatoryStatus.QUEUED,
  ClaimRegulatoryStatus.PROCESSING,
  ClaimRegulatoryStatus.ACKNOWLEDGED,
];

/**
 * Submits claim stages to TIRAMIS through the existing TIRAMIS module and
 * keeps one `claim_regulatory_operations` row per submitted stage record.
 * Success is never inferred from the HTTP call: the claim only advances when
 * ClaimTiramisOutcomeService applies the final TIRA response.
 */
@Injectable()
export class ClaimTiramisService {
  private readonly logger = new Logger(ClaimTiramisService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(ClaimRegulatoryOperation)
    private readonly operationRepository: Repository<ClaimRegulatoryOperation>,
    private readonly tiramisSubmitService: TiramisBusinessSubmitService,
    private readonly stateMachine: ClaimStateMachineService,
    private readonly hashService: ProductDefinitionHashService,
  ) {}

  async resolveOfficer(user: AuthenticatedUser) {
    const record = await this.dataSource.getRepository(User).findOne({
      where: { id: user.id },
    });
    const name = [record?.first_name, record?.last_name]
      .filter(Boolean)
      .join(' ')
      .trim();

    return {
      name: name || user.email,
      title: record?.officer_title?.trim() || 'Claims Officer',
    };
  }

  async submit(request: ClaimSubmissionRequest) {
    // Check the TIRAMIS v1.3 field rules before anything is written, so an
    // incomplete record never moves the claim to *_SUBMITTED.
    const errors = validateClaimTiramisPayload(
      request.operationType,
      request.payload,
    );

    if (errors.length > 0) {
      throw new BadRequestException({
        code: 'CLAIM_TIRAMIS_PAYLOAD_INVALID',
        message: `${this.label(request.operationType)} ${request.sourceRecordNumber} is not ready for TIRAMIS`,
        errors,
      });
    }

    const operation = await this.dataSource.transaction(async (manager) => {
      const claim = await manager
        .getRepository(InsuranceClaim)
        .createQueryBuilder('claim')
        .setLock('pessimistic_write')
        .where('claim.id = :id', { id: request.claim.id })
        .getOneOrFail();

      const existing = await manager
        .getRepository(ClaimRegulatoryOperation)
        .findOne({
          where: {
            operation_type: request.operationType,
            source_record_id: request.sourceRecordId,
          },
        });

      if (
        existing &&
        LOCKED_REGULATORY_STATUSES.includes(existing.status) &&
        !(request.retry && existing.status !== ClaimRegulatoryStatus.ACCEPTED)
      ) {
        throw new ConflictException({
          code: 'CLAIM_TIRAMIS_ALREADY_SUBMITTED',
          message: `${request.sourceRecordNumber} is already ${existing.status} at TIRAMIS`,
        });
      }

      if (request.submittedStatus) {
        await this.stateMachine.transition(
          manager,
          claim,
          request.submittedStatus,
          {
            eventType: 'TIRAMIS_SUBMITTED',
            summary: `${this.label(request.operationType)} ${request.sourceRecordNumber} submitted to TIRAMIS`,
            actorId: request.user.id,
            subjectType: request.operationType,
            subjectId: request.sourceRecordId,
          },
        );
      } else {
        await this.stateMachine.recordEvent(manager, claim, {
          eventType: 'TIRAMIS_SUBMITTED',
          summary: `${this.label(request.operationType)} ${request.sourceRecordNumber} submitted to TIRAMIS`,
          actorId: request.user.id,
          subjectType: request.operationType,
          subjectId: request.sourceRecordId,
        });
      }

      return this.upsertOperation(manager, claim, request, existing);
    });

    try {
      const result: any = await this.submitToTiramis(request);
      const tracking = result?.tracking ?? null;

      await this.operationRepository.update(
        { id: operation.id },
        {
          tiramis_tracking_id: result?.localTrackingId ?? tracking?.id ?? null,
          tiramis_transaction_id: tracking?.tiramisTransactionId ?? null,
          tiramis_request_id: tracking?.tiramisRequestId ?? null,
          acknowledgement_code: tracking?.acknowledgementStatusCode ?? null,
          acknowledgement_message: tracking?.acknowledgementStatusDesc ?? null,
        },
      );

      return {
        operationId: operation.id,
        trackingId: result?.localTrackingId ?? null,
        status: result?.localStatus ?? null,
      };
    } catch (error: any) {
      await this.markSubmissionError(request, operation, error);
      throw error;
    }
  }

  private async submitToTiramis(request: ClaimSubmissionRequest) {
    // The claims controller has already enforced the stage permission; the
    // TIRAMIS module additionally requires `tiramis.submit`, which the
    // claims role should not need separately.
    const authContext = {
      ...request.user,
      userId: request.user.id,
      permissions: Array.from(
        new Set([...(request.user.permissions ?? []), 'tiramis.submit']),
      ),
    };
    const params = {
      id: request.sourceRecordId,
      businessReference: request.sourceRecordNumber,
      payload: request.payload as Record<string, any>,
      authContext,
      forceResubmit: !!request.retry,
      returnExisting: !request.retry,
    };

    switch (request.operationType) {
      case ClaimRegulatoryOperationType.NOTIFICATION:
        return this.tiramisSubmitService.submitClaimNotification(params);
      case ClaimRegulatoryOperationType.INTIMATION:
        return this.tiramisSubmitService.submitClaimIntimation(params);
      case ClaimRegulatoryOperationType.ASSESSMENT:
        return this.tiramisSubmitService.submitClaimAssessment(params);
      case ClaimRegulatoryOperationType.DISCHARGE_VOUCHER:
        return this.tiramisSubmitService.submitDischargeVoucher(params);
      case ClaimRegulatoryOperationType.PAYMENT:
        return this.tiramisSubmitService.submitClaimPayment(params);
      case ClaimRegulatoryOperationType.REJECTION:
        return this.tiramisSubmitService.submitClaimRejection(params);
      default:
        throw new BadRequestException('Unsupported claim TIRAMIS operation');
    }
  }

  private async upsertOperation(
    manager: EntityManager,
    claim: InsuranceClaim,
    request: ClaimSubmissionRequest,
    existing: ClaimRegulatoryOperation | null,
  ) {
    const repository = manager.getRepository(ClaimRegulatoryOperation);
    const snapshot = request.payload;
    const values = {
      status: ClaimRegulatoryStatus.QUEUED,
      request_snapshot: snapshot,
      request_snapshot_hash: this.hashService.hashDefinition(snapshot),
      submitted_at: new Date(),
      acknowledged_at: null,
      completed_at: null,
      final_response_code: null,
      final_response_message: null,
    };

    if (existing) {
      Object.assign(existing, values);
      return repository.save(existing);
    }

    const sequence = await repository
      .createQueryBuilder('operation')
      .select('COALESCE(MAX(operation.sequence_number), 0)', 'max')
      .where('operation.claim_id = :claimId', { claimId: claim.id })
      .andWhere('operation.operation_type = :type', {
        type: request.operationType,
      })
      .getRawOne<{ max: string }>();

    return repository.save(
      repository.create({
        company_id: claim.company_id,
        claim_id: claim.id,
        operation_type: request.operationType,
        source_record_id: request.sourceRecordId,
        source_record_number: request.sourceRecordNumber,
        sequence_number: Number(sequence?.max ?? 0) + 1,
        ...values,
      }),
    );
  }

  /**
   * A submission that never produced a TIRAMIS tracking record (validation
   * or transport failure) is failed immediately; otherwise the outcome
   * handler owns the result.
   */
  private async markSubmissionError(
    request: ClaimSubmissionRequest,
    operation: ClaimRegulatoryOperation,
    error: any,
  ) {
    const message = this.errorMessage(error);

    await this.dataSource.transaction(async (manager) => {
      const current = await manager
        .getRepository(ClaimRegulatoryOperation)
        .findOneOrFail({ where: { id: operation.id } });

      if (current.status === ClaimRegulatoryStatus.ACCEPTED) {
        return;
      }

      current.status = ClaimRegulatoryStatus.FAILED;
      current.final_response_message = message;
      current.completed_at = new Date();
      await manager.getRepository(ClaimRegulatoryOperation).save(current);

      const claim = await manager
        .getRepository(InsuranceClaim)
        .createQueryBuilder('claim')
        .setLock('pessimistic_write')
        .where('claim.id = :id', { id: request.claim.id })
        .getOneOrFail();

      if (request.submittedStatus && request.failedStatus) {
        await this.stateMachine.transitionIfIn(
          manager,
          claim,
          [request.submittedStatus],
          request.failedStatus,
          {
            eventType: 'TIRAMIS_FAILED',
            summary: `${this.label(request.operationType)} submission failed: ${message}`,
            actorType: ClaimEventActorType.SYSTEM,
            subjectType: request.operationType,
            subjectId: request.sourceRecordId,
          },
        );
      } else {
        await this.stateMachine.recordEvent(manager, claim, {
          eventType: 'TIRAMIS_FAILED',
          summary: `${this.label(request.operationType)} submission failed: ${message}`,
          actorType: ClaimEventActorType.SYSTEM,
          subjectType: request.operationType,
          subjectId: request.sourceRecordId,
        });
      }
    });

    this.logger.warn(
      `Claim ${request.claim.claim_no} ${request.operationType} submission failed: ${message}`,
    );
  }

  private errorMessage(error: any): string {
    const response = error?.response;
    const errors = response?.errors;

    if (Array.isArray(errors) && errors.length > 0) {
      return errors.join('; ');
    }

    return String(response?.message ?? error?.message ?? 'Unknown error');
  }

  label(operationType: ClaimOperationType): string {
    switch (operationType) {
      case ClaimRegulatoryOperationType.NOTIFICATION:
        return 'Claim notification';
      case ClaimRegulatoryOperationType.INTIMATION:
        return 'Claim intimation';
      case ClaimRegulatoryOperationType.ASSESSMENT:
        return 'Claim assessment';
      case ClaimRegulatoryOperationType.DISCHARGE_VOUCHER:
        return 'Discharge voucher';
      case ClaimRegulatoryOperationType.PAYMENT:
        return 'Claim payment';
      case ClaimRegulatoryOperationType.REJECTION:
        return 'Claim rejection';
      default:
        return 'Claim operation';
    }
  }
}
