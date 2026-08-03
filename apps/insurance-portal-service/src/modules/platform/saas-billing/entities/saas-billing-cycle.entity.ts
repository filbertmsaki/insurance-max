import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { SaasBillingCycleStatus } from '../enums/saas-billing.enums';

@Entity('saas_billing_cycles')
export class SaasBillingCycle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  subscription_id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'timestamptz' })
  period_start: Date;

  @Column({ type: 'timestamptz' })
  period_end: Date;

  @Column({ length: 10, default: 'TZS' })
  currency: string;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  base_amount: string;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  usage_amount: string;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  discount_amount: string;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  tax_amount: string;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  total_amount: string;

  @Column({
    type: 'enum',
    enum: SaasBillingCycleStatus,
    default: SaasBillingCycleStatus.OPEN,
  })
  status: SaasBillingCycleStatus;

  @Column({ type: 'timestamptz', nullable: true })
  calculated_at!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  closed_at!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
