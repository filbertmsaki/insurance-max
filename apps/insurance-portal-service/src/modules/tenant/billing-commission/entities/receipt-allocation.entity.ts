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

import { User } from '../../users/entities/user.entity';
import { ReceiptAllocationStatus } from '../enums/finance-status.enums';
import { Invoice } from './invoice.entity';
import { Receipt } from './receipt.entity';

@Entity('receipt_allocations')
@Index('IDX_receipt_allocation_invoice', ['company_id', 'invoice_id', 'status'])
export class ReceiptAllocation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid' })
  receipt_id: string;

  @Column({ type: 'uuid' })
  invoice_id: string;

  @Column({ type: 'numeric', precision: 18, scale: 2 })
  amount: string;

  @Column({ type: 'varchar', length: 10 })
  currency: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  allocation_hash: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: ReceiptAllocationStatus.ACTIVE,
  })
  status: ReceiptAllocationStatus;

  @Column({ type: 'uuid', nullable: true })
  allocated_by: string | null;

  @Column({
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  allocated_at: Date;

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

  @ManyToOne(() => Receipt, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'receipt_id' })
  receipt: Receipt;

  @ManyToOne(() => Invoice, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'allocated_by' })
  allocator: User | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reversed_by' })
  reverser: User | null;
}
