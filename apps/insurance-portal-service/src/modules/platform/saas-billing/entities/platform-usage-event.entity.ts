import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('platform_usage_events')
export class PlatformUsageEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid', nullable: true })
  subscription_id!: string | null;

  @Column({ length: 100 })
  metric_code: string;

  @Column({ type: 'numeric', precision: 20, scale: 6 })
  quantity: string;

  @Column({ length: 180 })
  idempotency_key: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  resource_type!: string | null;

  @Column({ type: 'uuid', nullable: true })
  resource_id!: string | null;

  @Column({ length: 128, default: 'default' })
  dimension_key: string;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  dimensions!: Record<string, unknown>;

  @Column({ type: 'timestamptz' })
  occurred_at: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  recorded_at: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;
}
