import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('saas_invoice_items')
export class SaasInvoiceItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  invoice_id: string;

  @Column({ length: 50 })
  item_type: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'numeric', precision: 20, scale: 6, default: 1 })
  quantity: string;

  @Column({ type: 'numeric', precision: 20, scale: 6, default: 0 })
  unit_price: string;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  amount: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
