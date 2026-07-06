import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { TiramisNotificationDeliveryStatus } from '../enums/tiramis-notification-delivery-status.enum';
import { TiramisNotificationSeverity } from '../enums/tiramis-notification-severity.enum';
import { TiramisNotificationType } from '../enums/tiramis-notification-type.enum';
import { TiramisRequestType } from '../enums/tiramis-request-type.enum';

@Entity({ name: 'tiramis_notifications' })
@Index(['type'])
@Index(['severity'])
@Index(['sourceCompanyId'])
@Index(['sourceUserId'])
@Index(['sourceModule'])
@Index(['sourceRecordId'])
@Index(['businessReference'])
@Index(['localTrackingId'])
@Index(['isRead'])
@Index(['createdAt'])
export class TiramisNotificationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    name: 'type',
    type: 'varchar',
    length: 100,
  })
  type!: TiramisNotificationType;

  @Column({
    name: 'correlation_id',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  correlationId!: string | null;

  @Column({
    name: 'event_key',
    type: 'varchar',
    length: 180,
    nullable: true,
  })
  eventKey!: string | null;

  @Column({
    name: 'dedupe_key',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  dedupeKey!: string | null;

  @Column({
    name: 'channel',
    type: 'varchar',
    length: 40,
    default: 'IN_APP',
  })
  channel!: string;

  @Column({
    name: 'delivery_status',
    type: 'varchar',
    length: 40,
    default: TiramisNotificationDeliveryStatus.PENDING,
  })
  deliveryStatus!: TiramisNotificationDeliveryStatus;

  @Column({
    name: 'delivery_attempts',
    type: 'integer',
    default: 0,
  })
  deliveryAttempts!: number;

  @Column({
    name: 'last_delivery_attempt_at',
    type: 'timestamptz',
    nullable: true,
  })
  lastDeliveryAttemptAt!: Date | null;

  @Column({
    name: 'delivered_at',
    type: 'timestamptz',
    nullable: true,
  })
  deliveredAt!: Date | null;

  @Column({
    name: 'delivery_error_message',
    type: 'text',
    nullable: true,
  })
  deliveryErrorMessage!: string | null;

  @Column({
    name: 'severity',
    type: 'varchar',
    length: 30,
    default: TiramisNotificationSeverity.WARNING,
  })
  severity!: TiramisNotificationSeverity;

  @Column({
    name: 'title',
    type: 'varchar',
    length: 255,
  })
  title!: string;

  @Column({
    name: 'message',
    type: 'text',
  })
  message!: string;

  @Column({
    name: 'request_type',
    type: 'varchar',
    length: 80,
    nullable: true,
  })
  requestType?: TiramisRequestType | null;

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
    name: 'status',
    type: 'varchar',
    length: 80,
    nullable: true,
  })
  status?: string | null;

  @Column({
    name: 'error_message',
    type: 'text',
    nullable: true,
  })
  errorMessage?: string | null;

  @Column({
    name: 'is_read',
    type: 'boolean',
    default: false,
  })
  isRead!: boolean;

  @Column({
    name: 'read_at',
    type: 'timestamptz',
    nullable: true,
  })
  readAt?: Date | null;

  @Column({
    name: 'read_by_user_id',
    type: 'uuid',
    nullable: true,
  })
  readByUserId?: string | null;

  @Column({
    name: 'dismissed_at',
    type: 'timestamptz',
    nullable: true,
  })
  dismissedAt!: Date | null;

  @Column({
    name: 'dismissed_by_user_id',
    type: 'uuid',
    nullable: true,
  })
  dismissedByUserId!: string | null;

  @Column({
    name: 'expires_at',
    type: 'timestamptz',
    nullable: true,
  })
  expiresAt!: Date | null;

  @Column({
    name: 'metadata',
    type: 'jsonb',
    nullable: true,
  })
  metadata?: Record<string, any> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
