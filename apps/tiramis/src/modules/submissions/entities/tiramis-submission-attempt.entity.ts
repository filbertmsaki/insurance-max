import { BaseEntity } from '@insurance-max/persistence';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { TiramisTransactionEntity } from './tiramis-transaction.entity';

@Entity({ name: 'tiramis_submission_attempts' })
@Index(['requestId'], { unique: true })
@Index(['transactionId', 'attemptNo'], { unique: true })
export class TiramisSubmissionAttemptEntity extends BaseEntity {
  @Column({ name: 'transaction_id' })
  transactionId!: string;

  @ManyToOne(() => TiramisTransactionEntity, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'transaction_id' })
  transaction!: TiramisTransactionEntity;

  @Column({ name: 'attempt_no', type: 'int' })
  attemptNo!: number;

  @Column({ name: 'request_id', length: 50 })
  requestId!: string;

  @Column({
    name: 'previous_request_id',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  previousRequestId?: string | null;

  @Column({ name: 'root_element', length: 80 })
  rootElement!: string;

  @Column({
    name: 'resubmission_reason',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  resubmissionReason?: string | null;

  @Column({ length: 50, default: 'PENDING' })
  status!: string;

  @Column({ name: 'request_xml', type: 'text', nullable: true })
  requestXml?: string | null;

  @Column({ name: 'request_signature', type: 'text', nullable: true })
  requestSignature?: string | null;

  @Column({
    name: 'acknowledgement_id',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  acknowledgementId?: string | null;

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

  @Column({ name: 'acknowledgement_xml', type: 'text', nullable: true })
  acknowledgementXml?: string | null;

  @Column({ name: 'ack_received_at', type: 'timestamp', nullable: true })
  ackReceivedAt?: Date | null;

  @Column({ name: 'response_id', type: 'varchar', length: 50, nullable: true })
  responseId?: string | null;

  @Column({
    name: 'response_status_code',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  responseStatusCode?: string | null;

  @Column({
    name: 'response_status_desc',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  responseStatusDesc?: string | null;

  @Column({ name: 'response_xml', type: 'text', nullable: true })
  responseXml?: string | null;

  @Column({ name: 'response_signature', type: 'text', nullable: true })
  responseSignature?: string | null;

  @Column({
    name: 'final_response_received_at',
    type: 'timestamp',
    nullable: true,
  })
  finalResponseReceivedAt?: Date | null;

  @Column({
    name: 'response_acknowledgement_id',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  responseAcknowledgementId?: string | null;

  @Column({
    name: 'response_ack_status_code',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  responseAckStatusCode?: string | null;

  @Column({
    name: 'response_ack_status_desc',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  responseAckStatusDesc?: string | null;

  @Column({ name: 'response_ack_xml', type: 'text', nullable: true })
  responseAckXml?: string | null;

  @Column({ name: 'response_ack_sent_at', type: 'timestamp', nullable: true })
  responseAckSentAt?: Date | null;

  @Column({ name: 'sent_at', type: 'timestamp', nullable: true })
  sentAt?: Date | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string | null;

  @Column({ name: 'retry_count', type: 'int', default: 0 })
  retryCount!: number;

  @Column({ name: 'max_retries', type: 'int', default: 5 })
  maxRetries!: number;

  @Column({ name: 'is_retryable', type: 'int', default: 0 })
  isRetryable!: number;

  @Column({ name: 'next_retry_at', type: 'timestamptz', nullable: true })
  nextRetryAt?: Date | null;

  @Column({ name: 'last_retry_at', type: 'timestamptz', nullable: true })
  lastRetryAt?: Date | null;

  @Column({
    name: 'final_callback_deadline_at',
    type: 'timestamptz',
    nullable: true,
  })
  finalCallbackDeadlineAt?: Date | null;

  @Column({
    name: 'final_callback_overdue_notified',
    type: 'int',
    default: 0,
  })
  finalCallbackOverdueNotified!: number;
}
