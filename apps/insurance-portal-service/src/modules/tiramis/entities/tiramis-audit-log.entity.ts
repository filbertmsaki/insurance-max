import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { TiramisAuditAction } from '../enums/tiramis-audit-action.enum';
import { TiramisAuditSeverity } from '../enums/tiramis-audit-severity.enum';
import { TiramisRequestType } from '../enums/tiramis-request-type.enum';

@Entity({ name: 'tiramis_audit_logs' })
@Index(['action'])
@Index(['requestType'])
@Index(['sourceCompanyId'])
@Index(['sourceUserId'])
@Index(['sourceModule'])
@Index(['sourceRecordId'])
@Index(['businessReference'])
@Index(['localTrackingId'])
@Index(['createdAt'])
export class TiramisAuditLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    name: 'action',
    type: 'varchar',
    length: 100,
  })
  action!: TiramisAuditAction;

  @Column({
    name: 'correlation_id',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  correlationId?: string | null;

  @Column({
    name: 'event_key',
    type: 'varchar',
    length: 180,
    nullable: true,
  })
  eventKey?: string | null;

  @Column({
    name: 'severity',
    type: 'varchar',
    length: 30,
    default: TiramisAuditSeverity.INFO,
  })
  severity!: TiramisAuditSeverity;

  @Column({
    name: 'request_type',
    type: 'varchar',
    length: 80,
    nullable: true,
  })
  requestType?: TiramisRequestType | null;

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
    name: 'actor_user_type',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  actorUserType?: string | null;

  @Column({
    name: 'actor_email',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  actorEmail?: string | null;

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
    name: 'business_reference',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  businessReference?: string | null;

  @Column({
    name: 'local_tracking_id',
    type: 'uuid',
    nullable: true,
  })
  localTrackingId?: string | null;

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
    name: 'status_before',
    type: 'varchar',
    length: 80,
    nullable: true,
  })
  statusBefore?: string | null;

  @Column({
    name: 'status_after',
    type: 'varchar',
    length: 80,
    nullable: true,
  })
  statusAfter?: string | null;

  @Column({
    name: 'success',
    type: 'boolean',
    default: true,
  })
  success!: boolean;

  @Column({
    name: 'error_message',
    type: 'text',
    nullable: true,
  })
  errorMessage?: string | null;

  @Column({
    name: 'ip_address',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  ipAddress?: string | null;

  @Column({
    name: 'user_agent',
    type: 'text',
    nullable: true,
  })
  userAgent?: string | null;

  @Column({
    name: 'http_method',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  httpMethod?: string | null;

  @Column({
    name: 'endpoint',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  endpoint?: string | null;

  @Column({
    name: 'duration_ms',
    type: 'integer',
    nullable: true,
  })
  durationMs?: number | null;

  @Column({
    name: 'metadata',
    type: 'jsonb',
    nullable: true,
  })
  metadata?: Record<string, any> | null;

  @Column({
    name: 'request_payload_snapshot',
    type: 'jsonb',
    nullable: true,
  })
  requestPayloadSnapshot?: Record<string, any> | null;

  @Column({
    name: 'response_payload_snapshot',
    type: 'jsonb',
    nullable: true,
  })
  responsePayloadSnapshot?: Record<string, any> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
