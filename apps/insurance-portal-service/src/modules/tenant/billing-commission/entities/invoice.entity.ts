import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Company } from '../../../platform/companies/entities/company.entity';
import { Branch } from '../../branches/entities/branch.entity';
import { Customer } from '../../customers/entities/customer.entity';
import { Policy } from '../../policies/entities/policy.entity';
import { Quotation } from '../../quotations/entities/quotation.entity';
import { User } from '../../users/entities/user.entity';
import { InvoiceItem } from './invoice-item.entity';

@Entity('invoices')
@Index('IDX_invoices_company_id', ['company_id'])
@Index('IDX_invoices_company_status', ['company_id', 'status'])
@Index('IDX_invoices_company_customer_id', ['company_id', 'customer_id'])
@Index('IDX_invoices_company_invoice_no', ['company_id', 'invoice_no'], {
  unique: true,
  where: 'deleted_at IS NULL',
})
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid' })
  insurer_company_id: string;

  @Column({ type: 'uuid', nullable: true })
  intermediary_company_id: string | null;

  @Column({ type: 'uuid' })
  customer_id: string;

  @Column({ type: 'uuid', nullable: true })
  quotation_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  policy_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  endorsement_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  cancellation_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  renewal_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  branch_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  sale_point_id: string | null;

  @Column({ type: 'varchar', length: 50 })
  invoice_no: string;

  @Column({ type: 'varchar', length: 30 })
  invoice_type: string;

  @Column({ type: 'varchar', length: 40, default: 'MANUAL' })
  source_type: string;

  @Column({ type: 'uuid', nullable: true })
  source_record_id: string | null;

  @Column({ type: 'int', nullable: true })
  source_revision: number | null;

  @Column({ type: 'varchar', length: 10, default: 'TZS' })
  currency: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  gross_amount: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  discount_amount: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  tax_amount: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  charges_amount: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  total_amount: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  paid_amount: string;

  @Column({ type: 'numeric', precision: 20, scale: 4, default: 0 })
  allocated_amount: string;

  @Column({ type: 'numeric', precision: 20, scale: 4, default: 0 })
  refunded_amount: string;

  @Column({ type: 'numeric', precision: 20, scale: 4, default: 0 })
  written_off_amount: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  balance_amount: string;

  @Column({ type: 'varchar', length: 20, default: 'DRAFT' })
  status: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  pricing_result_hash: string | null;

  @Column({ type: 'jsonb', nullable: true })
  source_snapshot: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  source_snapshot_hash: string | null;

  @Column({ type: 'int', default: 1 })
  balance_revision: number;

  @Column({ type: 'varchar', length: 64, nullable: true })
  balance_hash: string | null;

  @Column({ type: 'int', default: 1 })
  state_version: number;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'date', nullable: true })
  due_date: string | null;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @Column({ type: 'uuid', nullable: true })
  updated_by: string | null;

  @Column({ type: 'uuid', nullable: true })
  posted_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  posted_at: Date | null;

  @Column({ type: 'uuid', nullable: true })
  issued_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  issued_at: Date | null;

  @Column({ type: 'uuid', nullable: true })
  voided_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  voided_at: Date | null;

  @Column({ type: 'text', nullable: true })
  void_reason: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'insurer_company_id' })
  insurer_company: Company;

  @ManyToOne(() => Company, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'intermediary_company_id' })
  intermediary_company: Company | null;

  @ManyToOne(() => Customer, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @ManyToOne(() => Branch, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'branch_id' })
  branch: Branch | null;

  @ManyToOne(() => Quotation, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'quotation_id' })
  quotation: Quotation | null;

  @ManyToOne(() => Policy, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'policy_id' })
  policy: Policy | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  creator: User | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'updated_by' })
  updater: User | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'posted_by' })
  poster: User | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'issued_by' })
  issuer: User | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'voided_by' })
  voider: User | null;

  @OneToMany(() => InvoiceItem, (item) => item.invoice)
  items: InvoiceItem[];
}
