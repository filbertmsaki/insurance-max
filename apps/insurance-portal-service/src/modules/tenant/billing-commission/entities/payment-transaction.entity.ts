import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Company } from '../../../platform/companies/entities/company.entity';
import { Customer } from '../../customers/entities/customer.entity';
import { User } from '../../users/entities/user.entity';
import { Invoice } from './invoice.entity';
import { Receipt } from './receipt.entity';

@Entity('payment_transactions')
@Index('IDX_payment_transactions_company_id', ['company_id'])
@Index('IDX_payment_transactions_invoice_id', ['invoice_id'])
@Index('IDX_payment_transactions_receipt_id', ['receipt_id'])
export class PaymentTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid', nullable: true })
  invoice_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  customer_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  receipt_id: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  transaction_no: string | null;

  @Column({ type: 'varchar', length: 50 })
  provider: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  provider_code: string | null;

  @Column({ type: 'varchar', length: 100 })
  provider_reference: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  provider_transaction_id: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  provider_event_id: string | null;

  @Column({ type: 'varchar', length: 100 })
  internal_reference: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  payment_method: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  amount: string;

  @Column({ type: 'varchar', length: 10, default: 'TZS' })
  currency: string;

  @Column({ type: 'numeric', precision: 20, scale: 4, nullable: true })
  provider_amount: string | null;

  @Column({ type: 'varchar', length: 3, nullable: true })
  provider_currency_code: string | null;

  @Column({ type: 'numeric', precision: 20, scale: 10, default: 1 })
  exchange_rate: string;

  @Column({ type: 'varchar', length: 20, default: 'PENDING' })
  status: string;

  @Column({ type: 'varchar', length: 180, nullable: true })
  payer_name: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  payer_phone: string | null;

  @Column({ type: 'varchar', length: 180, nullable: true })
  payer_email: string | null;

  @Column({ type: 'varchar', length: 180, nullable: true })
  payment_reference: string | null;

  @Column({ type: 'varchar', length: 180, nullable: true })
  bank_reference: string | null;

  @Column({ type: 'varchar', length: 180, nullable: true })
  channel_reference: string | null;

  @Column({ type: 'varchar', length: 180, nullable: true })
  idempotency_key: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  request_hash: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  provider_payload_hash: string | null;

  @Column({ type: 'jsonb', nullable: true })
  provider_payload_redacted: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  request_payload: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  response_payload: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 20, default: 'UNMATCHED' })
  reconciliation_status: string;

  @Column({ type: 'timestamptz', nullable: true })
  received_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  settled_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  failed_at: Date | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  failure_code: string | null;

  @Column({ type: 'text', nullable: true })
  failure_message: string | null;

  @Column({ type: 'uuid', nullable: true })
  reconciled_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  reconciled_at: Date | null;

  @Column({ type: 'uuid', nullable: true })
  bank_statement_line_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  reversed_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  reversed_at: Date | null;

  @Column({ type: 'text', nullable: true })
  reversal_reason: string | null;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @Column({ type: 'uuid', nullable: true })
  updated_by: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @ManyToOne(() => Invoice, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice | null;

  @ManyToOne(() => Customer, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer | null;

  @ManyToOne(() => Receipt, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'receipt_id' })
  receipt: Receipt | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  creator: User | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'updated_by' })
  updater: User | null;
}
