import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Invoice } from './invoice.entity';

@Entity('invoice_items')
@Index('IDX_invoice_items_invoice_id', ['invoice_id'])
export class InvoiceItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  invoice_id: string;

  @Column({ type: 'varchar', length: 50 })
  item_type: string;

  @Column({ type: 'varchar', length: 150 })
  item_name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  quantity: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  unit_amount: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  total_amount: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => Invoice, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice;
}
