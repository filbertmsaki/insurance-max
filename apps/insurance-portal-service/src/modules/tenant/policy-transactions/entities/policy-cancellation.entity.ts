import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type {
  CancellationMethod,
  CancellationReasonType,
} from '@insurance-max/contracts';

import { PolicyTransaction } from './policy-transaction.entity';

@Entity('policy_cancellations')
export class PolicyCancellation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid' })
  policy_transaction_id: string;

  @Column({ type: 'varchar', length: 50 })
  reason_type: CancellationReasonType;

  @Column({ type: 'varchar', length: 40 })
  cancellation_method: CancellationMethod;

  @Column({ type: 'date' })
  requested_effective_date: string;

  @Column({ type: 'date', nullable: true })
  approved_effective_date: string | null;

  @Column({ type: 'int' })
  policy_days: number;

  @Column({ type: 'int' })
  days_on_risk: number;

  @Column({ type: 'int' })
  remaining_days: number;

  @Column({ type: 'numeric', precision: 20, scale: 4 })
  gross_written_premium: string;

  @Column({ type: 'numeric', precision: 20, scale: 4 })
  earned_premium: string;

  @Column({ type: 'numeric', precision: 20, scale: 4 })
  unearned_premium: string;

  @Column({ type: 'numeric', precision: 20, scale: 4, default: 0 })
  cancellation_charge: string;

  @Column({ type: 'numeric', precision: 20, scale: 4, default: 0 })
  refund_amount: string;

  @Column({ type: 'numeric', precision: 20, scale: 4, default: 0 })
  amount_due: string;

  @Column({ type: 'boolean', default: false })
  claims_review_required: boolean;

  @Column({ type: 'varchar', length: 30, default: 'NOT_REQUIRED' })
  claims_review_status: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @OneToOne(() => PolicyTransaction, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'policy_transaction_id' })
  policy_transaction: PolicyTransaction;
}
