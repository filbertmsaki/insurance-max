import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('finance_refunds')
@Index('UQ_finance_refund_number_entity', ['company_id', 'refund_no'], {
  unique: true,
})
@Index('IDX_finance_refunds_source', [
  'company_id',
  'source_type',
  'source_record_id',
])
@Index(
  'UQ_finance_refund_source_receipt_invoice',
  ['company_id', 'source_type', 'source_record_id', 'receipt_id', 'invoice_id'],
  {
    unique: true,
    where:
      'source_type IS NOT NULL AND source_record_id IS NOT NULL AND receipt_id IS NOT NULL AND invoice_id IS NOT NULL',
  },
)
export class FinanceRefund {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'varchar', length: 80 })
  refund_no: string;

  @Column({ type: 'uuid', nullable: true })
  customer_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  invoice_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  receipt_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  payment_transaction_id: string | null;

  @Column({ type: 'varchar', length: 30, default: 'REQUESTED' })
  status: string;

  @Column({ type: 'varchar', length: 40 })
  payment_method: string;

  @Column({ type: 'numeric', precision: 20, scale: 4 })
  amount: string;

  @Column({ type: 'varchar', length: 3 })
  currency_code: string;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'uuid' })
  requested_by: string;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  requested_at: Date;

  @Column({ type: 'uuid', nullable: true })
  approved_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  approved_at: Date | null;

  @Column({ type: 'varchar', length: 180, nullable: true })
  provider_refund_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  paid_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  paid_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  failed_at: Date | null;

  @Column({ type: 'text', nullable: true })
  failure_message: string | null;

  @Column({ type: 'varchar', length: 180 })
  idempotency_key: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  refund_hash: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  source_type: string | null;

  @Column({ type: 'uuid', nullable: true })
  source_record_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  policy_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  endorsement_id: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
