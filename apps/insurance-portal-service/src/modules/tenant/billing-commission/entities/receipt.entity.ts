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
import { Branch } from '../../branches/entities/branch.entity';
import { Customer } from '../../customers/entities/customer.entity';
import { User } from '../../users/entities/user.entity';
import { Invoice } from './invoice.entity';
import { PaymentTransaction } from './payment-transaction.entity';

@Entity('receipts')
@Index('IDX_receipts_company_id', ['company_id'])
@Index('IDX_receipts_company_customer_id', ['company_id', 'customer_id'])
@Index('IDX_receipts_company_receipt_no', ['company_id', 'receipt_no'], {
  unique: true,
  where: 'deleted_at IS NULL',
})
export class Receipt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid' })
  customer_id: string;

  @Column({ type: 'uuid', nullable: true })
  payment_transaction_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  payer_customer_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  invoice_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  branch_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  sale_point_id: string | null;

  @Column({ type: 'varchar', length: 50 })
  receipt_no: string;

  @Column({ type: 'varchar', length: 50 })
  payment_method: string;

  @Column({ type: 'varchar', length: 180, nullable: true })
  payer_name: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  amount: string;

  @Column({ type: 'varchar', length: 10, default: 'TZS' })
  currency: string;

  @Column({ type: 'numeric', precision: 20, scale: 10, default: 1 })
  exchange_rate: string;

  @Column({ type: 'varchar', length: 3, nullable: true })
  base_currency_code: string | null;

  @Column({ type: 'numeric', precision: 20, scale: 4, nullable: true })
  base_currency_amount: string | null;

  @Column({ type: 'numeric', precision: 20, scale: 4, default: 0 })
  allocated_amount: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  unallocated_amount: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  payment_reference: string | null;

  @Column({ type: 'varchar', length: 180, nullable: true })
  provider_reference: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  receipt_hash: string | null;

  @Column({ type: 'int', default: 1 })
  state_version: number;

  @Column({ type: 'uuid', nullable: true })
  received_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  received_at: Date | null;

  @Column({ type: 'varchar', length: 20, default: 'RECEIVED' })
  status: string;

  @Column({ type: 'uuid', nullable: true })
  posted_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  posted_at: Date | null;

  @Column({ type: 'uuid', nullable: true })
  reversed_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  reversed_at: Date | null;

  @Column({ type: 'text', nullable: true })
  reversal_reason: string | null;

  @Column({ type: 'uuid', nullable: true })
  reversal_receipt_id: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @ManyToOne(() => Customer, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @ManyToOne(() => Customer, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'payer_customer_id' })
  payer_customer: Customer | null;

  @ManyToOne(() => Branch, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'branch_id' })
  branch: Branch | null;

  @ManyToOne(() => PaymentTransaction, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'payment_transaction_id' })
  payment_transaction: PaymentTransaction | null;

  @ManyToOne(() => Invoice, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'received_by' })
  receiver: User | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'posted_by' })
  poster: User | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reversed_by' })
  reverser: User | null;
}
