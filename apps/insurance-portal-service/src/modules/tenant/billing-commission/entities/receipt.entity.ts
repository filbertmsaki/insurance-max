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
  invoice_id: string | null;

  @Column({ type: 'varchar', length: 50 })
  receipt_no: string;

  @Column({ type: 'varchar', length: 50 })
  payment_method: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  amount: string;

  @Column({ type: 'varchar', length: 10, default: 'TZS' })
  currency: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  payment_reference: string | null;

  @Column({ type: 'uuid', nullable: true })
  received_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  received_at: Date | null;

  @Column({ type: 'varchar', length: 20, default: 'RECEIVED' })
  status: string;

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

  @ManyToOne(() => Invoice, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'received_by' })
  receiver: User | null;
}
