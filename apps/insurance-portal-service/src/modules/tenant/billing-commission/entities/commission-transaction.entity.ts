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
import { ProductCommissionRule } from '../../product-distribution/entities/product-commission-rule.entity';
import { User } from '../../users/entities/user.entity';
import { Invoice } from './invoice.entity';
import { Receipt } from './receipt.entity';
import { Policy } from '../../policies/entities/policy.entity';

@Entity('commission_transactions')
@Index('IDX_commission_transactions_company_id', ['company_id'])
@Index('IDX_commission_transactions_policy_id', ['policy_id'])
@Index('IDX_commission_transactions_status', ['status'])
export class CommissionTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid' })
  insurer_company_id: string;

  @Column({ type: 'uuid' })
  intermediary_company_id: string;

  @Column({ type: 'uuid' })
  policy_id: string;

  @Column({ type: 'uuid', nullable: true })
  invoice_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  receipt_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  commission_rule_id: string | null;

  @Column({ type: 'varchar', length: 30 })
  commission_type: string;

  @Column({ type: 'varchar', length: 30 })
  calculation_base: string;

  @Column({ type: 'numeric', precision: 20, scale: 4, default: 0 })
  gross_premium: string;

  @Column({ type: 'numeric', precision: 20, scale: 4, default: 0 })
  net_premium: string;

  @Column({ type: 'numeric', precision: 18, scale: 10, default: 0 })
  commission_rate: string;

  @Column({ type: 'numeric', precision: 20, scale: 4, default: 0 })
  commission_amount: string;

  @Column({ type: 'varchar', length: 20, default: 'PENDING' })
  status: string;

  @Column({ type: 'timestamptz', nullable: true })
  earned_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  paid_at: Date | null;

  @Column({ type: 'uuid', nullable: true })
  approved_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  approved_at: Date | null;

  @Column({ type: 'numeric', precision: 20, scale: 4, default: 0 })
  paid_amount: string;

  @Column({ type: 'numeric', precision: 20, scale: 4, default: 0 })
  balance_amount: string;

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
  @JoinColumn({ name: 'insurer_company_id' })
  insurer_company: Company;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'intermediary_company_id' })
  intermediary_company: Company;

  @ManyToOne(() => Invoice, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice | null;

  @ManyToOne(() => Receipt, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'receipt_id' })
  receipt: Receipt | null;

  @ManyToOne(() => ProductCommissionRule, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'commission_rule_id' })
  commission_rule: ProductCommissionRule | null;

  @ManyToOne(() => Policy, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'policy_id' })
  policy: Policy;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'approved_by' })
  approver: User | null;
}
