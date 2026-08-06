import {
  Column,
  CreateDateColumn,
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
import { FinanceReconciliationItem } from './finance-reconciliation-item.entity';

@Entity('finance_reconciliation_batches')
@Index('UQ_finance_reconciliation_batch_entity', ['company_id', 'batch_no'], {
  unique: true,
})
export class FinanceReconciliationBatch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'varchar', length: 80 })
  batch_no: string;

  @Column({ type: 'varchar', length: 50 })
  provider_code: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  account_reference: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  statement_reference: string | null;

  @Column({ type: 'date' })
  statement_date: string;

  @Column({ type: 'varchar', length: 3 })
  currency_code: string;

  @Column({ type: 'numeric', precision: 20, scale: 4, nullable: true })
  opening_balance: string | null;

  @Column({ type: 'numeric', precision: 20, scale: 4, nullable: true })
  closing_balance: string | null;

  @Column({ type: 'numeric', precision: 20, scale: 4, default: 0 })
  statement_total: string;

  @Column({ type: 'numeric', precision: 20, scale: 4, default: 0 })
  matched_total: string;

  @Column({ type: 'numeric', precision: 20, scale: 4, default: 0 })
  unmatched_total: string;

  @Column({ type: 'varchar', length: 30, default: 'DRAFT' })
  status: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  file_hash: string | null;

  @Column({ type: 'uuid', nullable: true })
  imported_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  imported_at: Date | null;

  @Column({ type: 'uuid', nullable: true })
  approved_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  approved_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'imported_by' })
  importer: User | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'approved_by' })
  approver: User | null;

  @OneToMany(() => FinanceReconciliationItem, (item) => item.batch)
  items: FinanceReconciliationItem[];
}
