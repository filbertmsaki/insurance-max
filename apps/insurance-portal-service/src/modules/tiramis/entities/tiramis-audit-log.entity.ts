import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { TiramisAuditAction } from '../enums/tiramis-audit-action.enum';
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
    name: 'metadata',
    type: 'jsonb',
    nullable: true,
  })
  metadata?: Record<string, any> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
