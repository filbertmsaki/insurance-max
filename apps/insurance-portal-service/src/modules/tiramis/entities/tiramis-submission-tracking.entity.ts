import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import type { TiramisIntegrationStatus } from '@insurance-max/contracts';

import { TiramisRequestType } from '../enums/tiramis-request-type.enum';
import { TiramisSubmissionStatus } from '../enums/tiramis-submission-status.enum';

@Entity({ name: 'tiramis_submission_tracking' })
@Index(['requestType'])
@Index(['businessReference'])
@Index(['businessFingerprint'])
@Index(['sourceCompanyId'])
@Index(['sourceRecordId'])
@Index(['idempotencyKey'])
@Index(['duplicateOfTrackingId'])
@Index(['isRetryable'])
@Index(['nextRetryAt'])
@Index(['retryLockId'])
@Index(['tiramisTransactionId'])
@Index(['tiramisRequestId'])
@Index(['status'])
@Index(['canonicalStatus'])
@Index(['correlationId'])
export class TiramisSubmissionTrackingEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    name: 'request_type',
    type: 'varchar',
    length: 80,
  })
  requestType!: TiramisRequestType;

  @Column({
    name: 'status',
    type: 'varchar',
    length: 50,
    default: TiramisSubmissionStatus.PENDING,
  })
  status!: TiramisSubmissionStatus;

  @Column({
    name: 'schema_version',
    type: 'varchar',
    length: 100,
    default: 'insurance-max.tiramis.submission.v1',
  })
  schemaVersion!: string;

  @Column({
    name: 'contract_version',
    type: 'varchar',
    length: 20,
    default: '1.0',
  })
  contractVersion!: string;

  @Column({
    name: 'workflow_revision',
    type: 'int',
    nullable: true,
  })
  workflowRevision?: number | null;

  @Column({
    name: 'correlation_id',
    type: 'uuid',
    nullable: true,
  })
  correlationId?: string | null;

  @Column({
    name: 'causation_id',
    type: 'uuid',
    nullable: true,
  })
  causationId?: string | null;

  @Column({
    name: 'canonical_status',
    type: 'varchar',
    length: 60,
    default: 'CREATED',
  })
  canonicalStatus!: TiramisIntegrationStatus | string;

  @Column({
    name: 'resource_version',
    type: 'int',
    default: 1,
  })
  resourceVersion!: number;

  @Column({
    name: 'source_service',
    type: 'varchar',
    length: 100,
    default: 'insurance-portal-service',
  })
  sourceService!: string;

  @Column({
    name: 'source_company_id',
    type: 'uuid',
    nullable: true,
  })
  sourceCompanyId?: string | null;

  /**
   * TIRAMIS environment this submission was sent to. Status sync, retries
   * and follow-ups stay on it even if the active environment changes later.
   */
  @Column({
    name: 'tiramis_environment',
    type: 'varchar',
    length: 10,
    nullable: true,
  })
  tiramisEnvironment?: 'local' | 'uat' | 'production' | null;

  @Column({
    name: 'source_user_id',
    type: 'uuid',
    nullable: true,
  })
  sourceUserId?: string | null;

  @Column({
    name: 'source_module',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  sourceModule?: string | null;

  @Column({
    name: 'source_record_id',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  sourceRecordId?: string | null;

  @Column({
    name: 'policy_id',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  policyId?: string | null;

  @Column({
    name: 'quotation_id',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  quotationId?: string | null;

  @Column({
    name: 'business_reference',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  businessReference?: string | null;

  @Column({
    name: 'business_fingerprint',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  businessFingerprint!: string | null;

  @Column({
    name: 'idempotency_key',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  idempotencyKey?: string | null;

  @Column({
    name: 'duplicate_of_tracking_id',
    type: 'uuid',
    nullable: true,
  })
  duplicateOfTrackingId?: string | null;

  @Column({
    name: 'duplicate_prevention_reason',
    type: 'text',
    nullable: true,
  })
  duplicatePreventionReason!: string | null;

  @Column({
    name: 'duplicate_checked_at',
    type: 'timestamptz',
    nullable: true,
  })
  duplicateCheckedAt!: Date | null;

  @Column({
    name: 'resubmission_count',
    type: 'int',
    default: 0,
  })
  resubmissionCount!: number;

  @Column({
    name: 'force_resubmitted',
    type: 'boolean',
    default: false,
  })
  forceResubmitted!: boolean;

  @Column({
    name: 'force_resubmit',
    type: 'boolean',
    default: false,
  })
  forceResubmit!: boolean;

  @Column({
    name: 'return_existing',
    type: 'boolean',
    default: false,
  })
  returnExisting!: boolean;

  @Column({
    name: 'tiramis_transaction_id',
    type: 'uuid',
    nullable: true,
  })
  tiramisTransactionId?: string | null;

  @Column({
    name: 'tiramis_request_id',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  tiramisRequestId?: string | null;

  @Column({
    name: 'tiramis_service_type',
    type: 'varchar',
    length: 80,
    nullable: true,
  })
  tiramisServiceType?: string | null;

  @Column({
    name: 'tiramis_root_element',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  tiramisRootElement?: string | null;

  @Column({
    name: 'acknowledgement_status_code',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  acknowledgementStatusCode?: string | null;

  @Column({
    name: 'acknowledgement_status_desc',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  acknowledgementStatusDesc?: string | null;

  @Column({
    name: 'last_error_message',
    type: 'text',
    nullable: true,
  })
  lastErrorMessage?: string | null;

  @Column({
    name: 'request_payload',
    type: 'jsonb',
    nullable: true,
  })
  requestPayload?: Record<string, any> | null;

  @Column({
    name: 'envelope',
    type: 'jsonb',
    nullable: true,
  })
  envelope?: Record<string, any> | null;

  @Column({
    name: 'payload_hash',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  payloadHash?: string | null;

  @Column({
    name: 'context_hash',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  contextHash?: string | null;

  @Column({
    name: 'envelope_hash',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  envelopeHash?: string | null;

  @Column({
    name: 'latest_event_sequence',
    type: 'int',
    default: 0,
  })
  latestEventSequence!: number;

  @Column({
    name: 'latest_event_id',
    type: 'uuid',
    nullable: true,
  })
  latestEventId?: string | null;

  @Column({
    name: 'reconciliation_required',
    type: 'boolean',
    default: false,
  })
  reconciliationRequired!: boolean;

  @Column({
    name: 'reconciliation_reason',
    type: 'text',
    nullable: true,
  })
  reconciliationReason?: string | null;

  @Column({
    name: 'last_reconciled_at',
    type: 'timestamptz',
    nullable: true,
  })
  lastReconciledAt?: Date | null;

  @Column({
    name: 'legacy_portal_submission_id',
    type: 'uuid',
    nullable: true,
  })
  legacyPortalSubmissionId?: string | null;

  @Column({
    name: 'tiramis_response_payload',
    type: 'jsonb',
    nullable: true,
  })
  tiramisResponsePayload?: Record<string, any> | null;

  @Column({
    name: 'submitted_at',
    type: 'timestamptz',
    nullable: true,
  })
  submittedAt?: Date | null;

  @Column({
    name: 'acknowledged_at',
    type: 'timestamptz',
    nullable: true,
  })
  acknowledgedAt?: Date | null;

  @Column({
    name: 'failed_at',
    type: 'timestamptz',
    nullable: true,
  })
  failedAt?: Date | null;

  @Column({
    name: 'final_response_id',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  finalResponseId?: string | null;

  @Column({
    name: 'final_response_status_code',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  finalResponseStatusCode?: string | null;

  @Column({
    name: 'final_response_status_desc',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  finalResponseStatusDesc?: string | null;

  @Column({
    name: 'final_response_received_at',
    type: 'timestamptz',
    nullable: true,
  })
  finalResponseReceivedAt?: Date | null;

  @Column({
    name: 'final_response_payload',
    type: 'jsonb',
    nullable: true,
  })
  finalResponsePayload?: Record<string, any> | null;

  @Column({
    name: 'last_synced_at',
    type: 'timestamptz',
    nullable: true,
  })
  lastSyncedAt?: Date | null;

  @Column({
    name: 'sync_attempts',
    type: 'int',
    default: 0,
  })
  syncAttempts!: number;

  @Column({
    name: 'business_record_synced_at',
    type: 'timestamptz',
    nullable: true,
  })
  businessRecordSyncedAt?: Date | null;

  @Column({
    name: 'business_record_sync_error',
    type: 'text',
    nullable: true,
  })
  businessRecordSyncError?: string | null;

  @Column({
    name: 'business_record_sync_attempts',
    type: 'int',
    default: 0,
  })
  businessRecordSyncAttempts!: number;

  @Column({
    name: 'is_retryable',
    type: 'boolean',
    default: false,
  })
  isRetryable!: boolean;

  @Column({
    name: 'retry_attempts',
    type: 'int',
    default: 0,
  })
  retryAttempts!: number;

  @Column({
    name: 'max_retry_attempts',
    type: 'int',
    default: 3,
  })
  maxRetryAttempts!: number;

  @Column({
    name: 'next_retry_at',
    type: 'timestamptz',
    nullable: true,
  })
  nextRetryAt?: Date | null;

  @Column({
    name: 'last_retry_at',
    type: 'timestamptz',
    nullable: true,
  })
  lastRetryAt?: Date | null;

  @Column({
    name: 'retry_lock_id',
    type: 'varchar',
    length: 120,
    nullable: true,
  })
  retryLockId?: string | null;

  @Column({
    name: 'retry_locked_at',
    type: 'timestamptz',
    nullable: true,
  })
  retryLockedAt?: Date | null;

  @Column({
    name: 'retry_error_message',
    type: 'text',
    nullable: true,
  })
  retryErrorMessage!: string | null;

  @Column({
    name: 'retry_strategy',
    type: 'varchar',
    length: 40,
    nullable: true,
    default: 'EXPONENTIAL_BACKOFF',
  })
  retryStrategy!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
