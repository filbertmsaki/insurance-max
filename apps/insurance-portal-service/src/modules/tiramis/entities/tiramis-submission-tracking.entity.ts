import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { TiramisRequestType } from '../enums/tiramis-request-type.enum';
import { TiramisSubmissionStatus } from '../enums/tiramis-submission-status.enum';

@Entity({ name: 'tiramis_submission_tracking' })
@Index(['requestType'])
@Index(['businessReference'])
@Index(['sourceCompanyId'])
@Index(['sourceRecordId'])
@Index(['tiramisTransactionId'])
@Index(['tiramisRequestId'])
@Index(['status'])
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

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
