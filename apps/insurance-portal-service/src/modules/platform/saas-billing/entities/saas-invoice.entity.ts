import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { SaasInvoiceStatus } from '../enums/saas-billing.enums';

@Entity('saas_invoices')
export class SaasInvoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  cycle_id: string;

  @Column({ type: 'uuid' })
  subscription_id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ length: 60, unique: true })
  invoice_no: string;

  @Column({ length: 10, default: 'TZS' })
  currency: string;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  subtotal_amount: string;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  tax_amount: string;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  total_amount: string;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  paid_amount: string;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  balance_amount: string;

  @Column({
    type: 'enum',
    enum: SaasInvoiceStatus,
    default: SaasInvoiceStatus.DRAFT,
  })
  status: SaasInvoiceStatus;

  @Column({ type: 'timestamptz', nullable: true })
  due_at!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  issued_at!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  voided_at!: Date | null;

  @Column({ type: 'uuid', nullable: true })
  created_by!: string | null;

  @Column({ type: 'uuid', nullable: true })
  updated_by!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
