import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import {
  BillingInterval,
  SubscriptionStatus,
} from '../enums/saas-billing.enums';

@Entity('company_subscriptions')
export class CompanySubscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid' })
  plan_id: string;

  @Column({ type: 'uuid', nullable: true })
  plan_version_id!: string | null;

  @Column({ length: 60, unique: true })
  subscription_no: string;

  @Column({
    type: 'enum',
    enum: SubscriptionStatus,
    default: SubscriptionStatus.TRIALING,
  })
  status: SubscriptionStatus;

  @Column({ type: 'enum', enum: BillingInterval })
  billing_interval: BillingInterval;

  @Column({ length: 10, default: 'TZS' })
  currency: string;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  base_price: string;

  @Column({ type: 'jsonb', nullable: true })
  plan_snapshot!: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  plan_snapshot_hash!: string | null;

  @Column({ type: 'timestamptz' })
  started_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  trial_ends_at!: Date | null;

  @Column({ type: 'timestamptz' })
  current_period_start: Date;

  @Column({ type: 'timestamptz' })
  current_period_end: Date;

  @Column({ type: 'timestamptz', nullable: true })
  grace_period_ends_at!: Date | null;

  @Column({ type: 'uuid', nullable: true })
  scheduled_plan_id!: string | null;

  @Column({ type: 'uuid', nullable: true })
  scheduled_plan_version_id!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  scheduled_change_at!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  last_billed_at!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  next_billing_at!: Date | null;

  @Column({ type: 'int', default: 1 })
  state_version: number;

  @Column({ default: false })
  cancel_at_period_end: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  cancelled_at!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  suspended_at!: Date | null;

  @Column({ type: 'text', nullable: true })
  suspension_reason!: string | null;

  @Column({ type: 'uuid', nullable: true })
  created_by!: string | null;

  @Column({ type: 'uuid', nullable: true })
  updated_by!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at!: Date | null;
}
