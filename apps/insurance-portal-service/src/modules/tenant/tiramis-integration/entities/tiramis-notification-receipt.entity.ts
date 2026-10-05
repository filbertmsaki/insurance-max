import { BaseEntity } from '@insurance-max/persistence';
import { Column, Entity, Index } from 'typeorm';

export type TiramisNotificationReceiptStatus =
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED';

@Entity({ name: 'tiramis_notification_receipts' })
@Index(['eventKey'], { unique: true })
@Index(['requestId'])
@Index(['responseId'])
export class TiramisNotificationReceipt extends BaseEntity {
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

  @Column({
    name: 'payload_hash',
    type: 'varchar',
    length: 128,
    nullable: true,
  })
  payloadHash?: string | null;

  @Column({
    name: 'processing_status',
    type: 'varchar',
    length: 30,
    default: 'PROCESSING',
  })
  processingStatus!: TiramisNotificationReceiptStatus;

  @Column({ name: 'receive_count', type: 'int', default: 1 })
  receiveCount!: number;

  @Column({ name: 'last_received_at', type: 'timestamp', nullable: true })
  lastReceivedAt?: Date | null;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError?: string | null;
}
