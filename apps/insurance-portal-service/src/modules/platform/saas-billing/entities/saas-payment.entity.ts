import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { SaasPaymentStatus } from '../enums/saas-billing.enums';

@Entity('saas_payments')
export class SaasPayment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  invoice_id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ length: 100 })
  payment_reference: string;

  @Column({ length: 10, default: 'TZS' })
  currency: string;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  amount: string;

  @Column({
    type: 'enum',
    enum: SaasPaymentStatus,
    default: SaasPaymentStatus.CONFIRMED,
  })
  status: SaasPaymentStatus;

  @Column({ type: 'date' })
  payment_date: string;

  @Column({ type: 'uuid', nullable: true })
  recorded_by!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
