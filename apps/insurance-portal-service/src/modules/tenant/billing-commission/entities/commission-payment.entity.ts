import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Company } from '../../../platform/companies/entities/company.entity';
import { User } from '../../users/entities/user.entity';
import { CommissionPaymentItem } from './commission-payment-item.entity';

@Entity('commission_payments')
@Index('IDX_commission_payments_company_id', ['company_id'])
@Index('IDX_commission_payments_intermediary_company_id', [
  'intermediary_company_id',
])
@Index('IDX_commission_payments_payment_no', ['company_id', 'payment_no'], {
  unique: true,
  where: 'deleted_at IS NULL',
})
export class CommissionPayment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid' })
  intermediary_company_id: string;

  @Column({ type: 'varchar', length: 50 })
  payment_no: string;

  @Column({ type: 'varchar', length: 50 })
  payment_method: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  payment_reference: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  total_amount: string;

  @Column({ type: 'varchar', length: 10, default: 'TZS' })
  currency: string;

  @Column({ type: 'varchar', length: 20, default: 'PENDING' })
  status: string;

  @Column({ type: 'uuid', nullable: true })
  approved_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  approved_at: Date | null;

  @Column({ type: 'uuid', nullable: true })
  paid_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  paid_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'intermediary_company_id' })
  intermediary_company: Company;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'approved_by' })
  approver: User | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'paid_by' })
  payer: User | null;

  @OneToMany(() => CommissionPaymentItem, (item) => item.commission_payment)
  items: CommissionPaymentItem[];
}
