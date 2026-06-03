import { BaseEntity } from '@insurance-max/persistence';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { TiramisSubmissionAttemptEntity } from './tiramis-submission-attempt.entity';
import { TiramisTransactionEntity } from './tiramis-transaction.entity';

@Entity({ name: 'tiramis_submission_events' })
@Index(['requestId'])
@Index(['eventType'])
export class TiramisSubmissionEventEntity extends BaseEntity {
  @Column({ name: 'transaction_id' })
  transactionId!: string;

  @ManyToOne(() => TiramisTransactionEntity, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'transaction_id' })
  transaction!: TiramisTransactionEntity;

  @Column({ name: 'attempt_id' })
  attemptId!: string;

  @ManyToOne(() => TiramisSubmissionAttemptEntity, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'attempt_id' })
  attempt!: TiramisSubmissionAttemptEntity;

  @Column({ name: 'event_type', length: 80 })
  eventType!: string;

  @Column({ name: 'request_id', length: 50 })
  requestId!: string;

  @Column({ name: 'status_code', length: 20, nullable: true })
  statusCode?: string | null;

  @Column({ name: 'status_desc', length: 255, nullable: true })
  statusDesc?: string | null;

  @Column({ name: 'raw_payload', type: 'text', nullable: true })
  rawPayload?: string | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string | null;
}
