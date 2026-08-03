import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { PremiumLevyReturnStatus } from '../enums/regulatory.enums';

@Entity('premium_levy_returns')
export class PremiumLevyReturn {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid', nullable: true })
  regulatory_return_id!: string | null;

  @Column({ length: 60, unique: true })
  levy_no: string;

  @Column({
    type: 'enum',
    enum: PremiumLevyReturnStatus,
    default: PremiumLevyReturnStatus.DRAFT,
  })
  status: PremiumLevyReturnStatus;

  @Column({ type: 'date' })
  period_start: string;

  @Column({ type: 'date' })
  period_end: string;

  @Column({ length: 10, default: 'TZS' })
  currency: string;

  @Column({ type: 'numeric', precision: 18, scale: 10, default: 0 })
  levy_rate: string;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  gross_premium: string;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  adjustments_amount: string;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  levy_amount: string;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  billed_amount: string;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  paid_amount: string;

  @Column({ type: 'timestamptz', nullable: true })
  statement_received_at!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  statement_due_at!: Date | null;

  @Column({ length: 80, nullable: true })
  control_number!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  control_number_received_at!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  payment_due_at!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  paid_at!: Date | null;

  @Column({ type: 'uuid', nullable: true })
  prepared_by!: string | null;

  @Column({ type: 'uuid', nullable: true })
  confirmed_by!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at!: Date | null;
}
