import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { User } from '../../users/entities/user.entity';
import { PaymentTransaction } from './payment-transaction.entity';
import { Receipt } from './receipt.entity';
import { FinanceReconciliationBatch } from './finance-reconciliation-batch.entity';

@Entity('finance_reconciliation_items')
@Index('UQ_reconciliation_batch_line_entity', ['batch_id', 'line_number'], {
  unique: true,
})
@Index(
  'UQ_reconciliation_matched_payment_active',
  ['matched_payment_transaction_id'],
  {
    unique: true,
    where: "status = 'MATCHED' AND matched_payment_transaction_id IS NOT NULL",
  },
)
@Index('UQ_reconciliation_matched_receipt_active', ['matched_receipt_id'], {
  unique: true,
  where: "status = 'MATCHED' AND matched_receipt_id IS NOT NULL",
})
export class FinanceReconciliationItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid' })
  batch_id: string;

  @Column({ type: 'int' })
  line_number: number;

  @Column({ type: 'date' })
  transaction_date: string;

  @Column({ type: 'date', nullable: true })
  value_date: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 180, nullable: true })
  external_reference: string | null;

  @Column({ type: 'varchar', length: 180, nullable: true })
  payer_reference: string | null;

  @Column({ type: 'numeric', precision: 20, scale: 4 })
  amount: string;

  @Column({ type: 'varchar', length: 3 })
  currency_code: string;

  @Column({ type: 'varchar', length: 30, default: 'UNMATCHED' })
  status: string;

  @Column({ type: 'uuid', nullable: true })
  matched_payment_transaction_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  matched_receipt_id: string | null;

  @Column({ type: 'numeric', precision: 8, scale: 4, nullable: true })
  match_score: string | null;

  @Column({ type: 'text', nullable: true })
  match_reason: string | null;

  @Column({ type: 'uuid', nullable: true })
  matched_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  matched_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => FinanceReconciliationBatch, (batch) => batch.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'batch_id' })
  batch: FinanceReconciliationBatch;

  @ManyToOne(() => PaymentTransaction, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'matched_payment_transaction_id' })
  matched_payment_transaction: PaymentTransaction | null;

  @ManyToOne(() => Receipt, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'matched_receipt_id' })
  matched_receipt: Receipt | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'matched_by' })
  matcher: User | null;
}
