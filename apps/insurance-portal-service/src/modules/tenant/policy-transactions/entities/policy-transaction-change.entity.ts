import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type {
  PolicyChangeCategory,
  PolicyTransactionChangeType,
} from '@insurance-max/contracts';

import { PolicyTransaction } from './policy-transaction.entity';

@Entity('policy_transaction_changes')
@Index('IDX_policy_transaction_changes_transaction', ['policy_transaction_id'])
export class PolicyTransactionChange {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid' })
  policy_transaction_id: string;

  @Column({ type: 'varchar', length: 50 })
  category: PolicyChangeCategory;

  @Column({ type: 'varchar', length: 20 })
  operation: PolicyTransactionChangeType;

  @Column({ type: 'varchar', length: 300 })
  field_path: string;

  @Column({ type: 'uuid', nullable: true })
  resource_id: string | null;

  @Column({ type: 'jsonb', nullable: true })
  old_value: unknown;

  @Column({ type: 'jsonb', nullable: true })
  new_value: unknown;

  @Column({ type: 'boolean', default: true })
  is_material: boolean;

  @Column({ type: 'boolean', default: false })
  requires_repricing: boolean;

  @Column({ type: 'boolean', default: true })
  requires_regulatory_submission: boolean;

  @Column({ type: 'varchar', length: 64 })
  change_hash: string;

  @Column({ type: 'uuid' })
  created_by: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @ManyToOne(() => PolicyTransaction, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'policy_transaction_id' })
  policy_transaction: PolicyTransaction;
}
