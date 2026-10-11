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

@Entity('payment_references')
@Index('IDX_payment_references_company_invoice', ['company_id', 'invoice_id'])
@Index('IDX_payment_references_company_status', ['company_id', 'status'])
@Index('IDX_payment_references_company_method_status', [
  'company_id',
  'invoice_id',
  'method',
  'status',
])
@Index(
  'UQ_payment_references_company_control_number_active',
  ['company_id', 'control_number'],
  {
    unique: true,
    where: '"deleted_at" IS NULL AND "control_number" IS NOT NULL',
  },
)
@Index(
  'UQ_payment_references_provider_reference_active',
  ['company_id', 'provider', 'provider_reference'],
  {
    unique: true,
    where: '"deleted_at" IS NULL',
  },
)
export class PaymentReference {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid' })
  invoice_id: string;

  @Column({ type: 'varchar', length: 50 })
  provider: string;

  @Column({ type: 'varchar', length: 50 })
  method: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  channel: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  control_number: string | null;

  @Column({ type: 'varchar', length: 180 })
  provider_reference: string;

  @Column({ type: 'varchar', length: 180, nullable: true })
  external_bill_id: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 2 })
  amount: string;

  @Column({ type: 'varchar', length: 10, default: 'TZS' })
  currency: string;

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status: string;

  @Column({ type: 'timestamptz', nullable: true })
  expires_at: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  provider_metadata: Record<string, unknown> | null;

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

  @ManyToOne(() => Invoice, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice;
}
