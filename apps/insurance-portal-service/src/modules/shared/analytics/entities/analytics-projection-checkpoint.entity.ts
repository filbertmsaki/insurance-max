import { AnalyticsDataFreshness } from '@insurance-max/contracts';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('analytics_projection_checkpoints')
export class AnalyticsProjectionCheckpoint {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  projector_key: string;

  @Column({ type: 'bigint', default: 0 })
  last_sequence_no: string;

  @Column({ type: 'timestamptz', nullable: true })
  last_processed_at!: Date | null;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  metadata: Record<string, unknown>;

  @Column({ type: 'uuid', nullable: true })
  company_id!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  projection_code!: string | null;

  @Column({ type: 'varchar', length: 30, default: 'CURRENT' })
  status: AnalyticsDataFreshness;

  @Column({ type: 'bigint', default: 0 })
  last_event_sequence: string;

  @Column({ type: 'timestamptz', nullable: true })
  last_event_at!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  last_projected_at!: Date | null;

  @Column({ type: 'text', nullable: true })
  failure_reason!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
