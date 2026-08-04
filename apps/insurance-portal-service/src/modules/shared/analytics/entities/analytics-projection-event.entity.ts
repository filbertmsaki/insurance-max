import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

import {
  AnalyticsAggregateType,
  AnalyticsEventType,
  AnalyticsProjectionStatus,
} from '../enums/analytics.enums';

@Entity('analytics_projection_events')
@Index('IDX_projection_events_pending', [
  'status',
  'next_attempt_at',
  'sequence_no',
])
export class AnalyticsProjectionEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'bigint',
    generated: 'increment',
  })
  sequence_no: string;

  @Column({
    type: 'varchar',
    length: 220,
    unique: true,
  })
  event_key: string;

  @Column({
    type: 'uuid',
    nullable: true,
  })
  company_id: string | null;

  @Column({
    type: 'uuid',
    nullable: true,
  })
  branch_id: string | null;

  @Column({
    type: 'varchar',
    length: 80,
  })
  source_module: string;

  @Column({
    type: 'varchar',
    length: 80,
  })
  aggregate_type:
    AnalyticsAggregateType;

  @Column({ type: 'uuid' })
  aggregate_id: string;

  @Column({
    type: 'varchar',
    length: 40,
  })
  event_type: AnalyticsEventType;

  @Column({
    type: 'varchar',
    length: 100,
  })
  event_version: string;

  @Column({ type: 'timestamptz' })
  occurred_at: Date;

  @Column({
    type: 'jsonb',
    default: () => "'{}'",
  })
  payload: Record<string, unknown>;

  @Column({
    type: 'varchar',
    length: 30,
    default:
      AnalyticsProjectionStatus.PENDING,
  })
  status: AnalyticsProjectionStatus;

  @Column({
    type: 'int',
    default: 0,
  })
  attempt_count: number;

  @Column({
    type: 'timestamptz',
    default: () => 'now()',
  })
  next_attempt_at: Date;

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  locked_at: Date | null;

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  processed_at: Date | null;

  @Column({
    type: 'text',
    nullable: true,
  })
  last_error: string | null;

  @CreateDateColumn({
    type: 'timestamptz',
  })
  created_at: Date;
}
