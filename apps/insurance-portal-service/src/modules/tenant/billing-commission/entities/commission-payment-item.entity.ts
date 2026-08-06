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

  @Column({ type: 'varchar', length: 30, default: 'ACTIVE' })
  status: string;

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

  @ManyToOne(() => CommissionPayment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'commission_payment_id' })
  commission_payment: CommissionPayment;

  @ManyToOne(() => CommissionTransaction, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'commission_transaction_id' })
  commission_transaction: CommissionTransaction;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'allocated_by' })
  allocator: User | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reversed_by' })
  reverser: User | null;
}
