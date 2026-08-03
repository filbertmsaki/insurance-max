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
  receipt_id: string | null;

  @Column({ type: 'varchar', length: 50 })
  provider: string;

  @Column({ type: 'varchar', length: 100 })
  provider_reference: string;

  @Column({ type: 'varchar', length: 100 })
  internal_reference: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  amount: string;

  @Column({ type: 'varchar', length: 10, default: 'TZS' })
  currency: string;

  @Column({ type: 'varchar', length: 20, default: 'PENDING' })
  status: string;

  @Column({ type: 'jsonb', nullable: true })
  request_payload: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  response_payload: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 20, default: 'UNMATCHED' })
  reconciliation_status: string;

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

  @ManyToOne(() => Receipt, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'receipt_id' })
  receipt: Receipt | null;
}
