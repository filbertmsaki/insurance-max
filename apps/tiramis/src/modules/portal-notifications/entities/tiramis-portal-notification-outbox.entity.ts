import { BaseEntity } from '@insurance-max/persistence';
import { Column, Entity, Index } from 'typeorm';

export type TiramisPortalNotificationOutboxStatus =
  | 'PENDING'
  | 'SENT'
  | 'FAILED'
  | 'DEAD';

@Entity({ name: 'tiramis_portal_notification_outbox' })
@Index(['eventKey'], { unique: true })
@Index(['status', 'nextAttemptAt'])
@Index(['requestId'])
@Index(['responseId'])
export class TiramisPortalNotificationOutboxEntity extends BaseEntity {
  @Column({ name: 'event_key', type: 'varchar', length: 255 })
  eventKey!: string;

  @Column({ name: 'request_id', type: 'varchar', length: 100 })
  requestId!: string;

  @Column({
    name: 'response_id',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  responseId?: string | null;

  @Column({ name: 'event_type', type: 'varchar', length: 100 })
  eventType!: string;

  @Column({ name: 'webhook_url', type: 'varchar', length: 500 })
  webhookUrl!: string;

  @Column({
    name: 'client_configuration_id',
    type: 'uuid',
    nullable: true,
  })
  clientConfigurationId?: string | null;

  @Column({ name: 'payload', type: 'jsonb' })
  payload!: Record<string, any>;

  @Column({
    name: 'status',
    type: 'varchar',
    length: 20,
    default: 'PENDING',
  })
  status!: TiramisPortalNotificationOutboxStatus;

  @Column({ name: 'attempt_count', type: 'int', default: 0 })
  attemptCount!: number;

  @Column({ name: 'next_attempt_at', type: 'timestamp', nullable: true })
  nextAttemptAt?: Date | null;

  @Column({ name: 'last_attempt_at', type: 'timestamp', nullable: true })
  lastAttemptAt?: Date | null;

  @Column({ name: 'sent_at', type: 'timestamp', nullable: true })
  sentAt?: Date | null;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError?: string | null;
}
