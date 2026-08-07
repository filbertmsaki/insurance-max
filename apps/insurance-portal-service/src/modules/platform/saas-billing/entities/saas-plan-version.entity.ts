import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

import {
  BillingInterval,
  SaasPlanVersionStatus,
} from '../enums/saas-billing.enums';

@Entity('saas_plan_versions')
export class SaasPlanVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  plan_id: string;

  @Column({ type: 'int' })
  version_number: number;

  @Column({
    type: 'enum',
    enum: SaasPlanVersionStatus,
    default: SaasPlanVersionStatus.DRAFT,
  })
  status: SaasPlanVersionStatus;

  @Column({ length: 150 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'enum', enum: BillingInterval })
  billing_interval: BillingInterval;

  @Column({ length: 10 })
  currency: string;

  @Column({ type: 'numeric', precision: 20, scale: 4 })
  base_price: string;

  @Column({ type: 'int', default: 0 })
  trial_days: number;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  feature_snapshot: Array<Record<string, unknown>>;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  meter_rate_snapshot: Array<Record<string, unknown>>;

  @Column({ type: 'jsonb' })
  plan_snapshot: Record<string, unknown>;

  @Column({ length: 64 })
  plan_snapshot_hash: string;

  @Column({ type: 'timestamptz', nullable: true })
  effective_from!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  effective_to!: Date | null;

  @Column({ type: 'uuid' })
  created_by: string;

  @Column({ type: 'uuid', nullable: true })
  approved_by!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  approved_at!: Date | null;
}
