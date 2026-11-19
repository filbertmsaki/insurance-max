import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('finance_outbox_events')
@Index('UQ_finance_outbox_event_key_entity', ['company_id', 'event_key'], {
  unique: true,
})
export class FinanceOutboxEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'varchar', length: 80 })
  aggregate_type: string;

  @Column({ type: 'uuid' })
  aggregate_id: string;

  @Column({ type: 'varchar', length: 100 })
  event_type: string;

  @Column({ type: 'varchar', length: 180 })
  event_key: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @Column({ type: 'varchar', length: 30, default: 'PENDING' })
  status: string;

  @Column({ type: 'int', default: 0 })
  attempt_count: number;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  next_attempt_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  published_at: Date | null;

  /** Fencing token: bumped on every claim; outcome writes must match it. */
  @Column({ type: 'bigint', default: 0 })
  claim_generation: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  claimed_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  claimed_at: Date | null;

  /** Contract schema version; legacy unversioned rows are version 1. */
  @Column({ type: 'int', default: 1 })
  schema_version: number;

  @Column({ type: 'varchar', length: 30, nullable: true })
  failure_class: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  processing_started_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  last_processed_at: Date | null;

  /** Set while an approved replay is queued; copied into attempt history. */
  @Column({ type: 'uuid', nullable: true })
  replay_request_id: string | null;

  @Column({ type: 'text', nullable: true })
  last_error: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
