import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { BillingInterval, SaasPlanStatus } from '../enums/saas-billing.enums';

@Entity('saas_plans')
export class SaasPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 60, unique: true })
  code: string;

  @Column({ length: 150 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  applicable_company_types!: string[];

  @Column({ type: 'enum', enum: BillingInterval })
  billing_interval: BillingInterval;

  @Column({ length: 10, default: 'TZS' })
  currency: string;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  base_price: string;

  @Column({ type: 'int', default: 0 })
  trial_days: number;

  @Column({
    type: 'enum',
    enum: SaasPlanStatus,
    default: SaasPlanStatus.DRAFT,
  })
  status: SaasPlanStatus;

  @Column({ type: 'uuid', nullable: true })
  created_by!: string | null;

  @Column({ type: 'uuid', nullable: true })
  updated_by!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at!: Date | null;
}
