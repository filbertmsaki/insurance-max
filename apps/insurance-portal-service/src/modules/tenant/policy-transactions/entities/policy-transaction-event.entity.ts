import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import type { PolicyTransactionEventType } from '@insurance-max/contracts';

import { PolicyTransaction } from './policy-transaction.entity';

@Entity('policy_transaction_events')
@Unique('UQ_policy_transaction_source_event', ['source_event_id', 'event_type'])
@Index('IDX_policy_transaction_events_transaction', [
  'policy_transaction_id',
  'created_at',
])
export class PolicyTransactionEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid' })
  policy_transaction_id: string;

  @Column({ type: 'varchar', length: 100 })
  event_type: PolicyTransactionEventType;

  @Column({ type: 'varchar', length: 30, default: 'SYSTEM' })
  actor_type: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  actor_id: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  from_stage: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  to_stage: string | null;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ type: 'uuid', nullable: true })
  source_event_id: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @ManyToOne(() => PolicyTransaction, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'policy_transaction_id' })
  policy_transaction: PolicyTransaction;
}
