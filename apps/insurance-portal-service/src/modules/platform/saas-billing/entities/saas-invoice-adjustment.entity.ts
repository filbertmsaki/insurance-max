import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import {
  SaasInvoiceAdjustmentStatus,
  SaasInvoiceAdjustmentType,
} from '../enums/saas-billing.enums';

@Entity('saas_invoice_adjustments')
export class SaasInvoiceAdjustment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid' })
  invoice_id: string;

  @Column({ length: 80, unique: true })
  adjustment_no: string;

  @Column({
    type: 'enum',
    enum: SaasInvoiceAdjustmentType,
  })
  adjustment_type: SaasInvoiceAdjustmentType;

  @Column({ type: 'numeric', precision: 20, scale: 4 })
  amount: string;

  @Column({ length: 3 })
  currency: string;

  @Column({ type: 'text' })
  reason: string;

  @Column({
    type: 'enum',
    enum: SaasInvoiceAdjustmentStatus,
    default: SaasInvoiceAdjustmentStatus.DRAFT,
  })
  status: SaasInvoiceAdjustmentStatus;

  @Column({ type: 'uuid' })
  created_by: string;

  @Column({ type: 'uuid', nullable: true })
  approved_by!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  approved_at!: Date | null;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
