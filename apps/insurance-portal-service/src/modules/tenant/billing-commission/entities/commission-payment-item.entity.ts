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
import { CommissionPayment } from './commission-payment.entity';
import { CommissionTransaction } from './commission-transaction.entity';

@Entity('commission_payment_items')
@Index('IDX_cpi_commission_payment_id', ['commission_payment_id'])
@Index('IDX_cpi_commission_transaction_id', ['commission_transaction_id'])
export class CommissionPaymentItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  commission_payment_id: string;

  @Column({ type: 'uuid' })
  commission_transaction_id: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  amount: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => CommissionPayment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'commission_payment_id' })
  commission_payment: CommissionPayment;

  @ManyToOne(() => CommissionTransaction, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'commission_transaction_id' })
  commission_transaction: CommissionTransaction;
}
