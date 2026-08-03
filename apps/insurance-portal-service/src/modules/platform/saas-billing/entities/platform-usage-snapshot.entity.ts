import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('platform_usage_snapshots')
export class PlatformUsageSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid', nullable: true })
  subscription_id!: string | null;

  @Column({ length: 100 })
  metric_code: string;

  @Column({ type: 'timestamptz' })
  period_start: Date;

  @Column({ type: 'timestamptz' })
  period_end: Date;

  @Column({ length: 128, default: 'default' })
  dimension_key: string;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  dimensions!: Record<string, unknown>;

  @Column({ type: 'numeric', precision: 20, scale: 6, default: 0 })
  quantity: string;

  @CreateDateColumn({ type: 'timestamptz' })
  calculated_at: Date;
}
