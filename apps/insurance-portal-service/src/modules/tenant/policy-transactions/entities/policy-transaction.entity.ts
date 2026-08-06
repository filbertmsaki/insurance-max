import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import type {
  PolicyTransactionPremiumEffect,
  PolicyTransactionStage,
  PolicyTransactionType,
  WorkflowApprovalStatus,
  WorkflowPaymentStatus,
  WorkflowSubmissionStatus,
} from '@insurance-max/contracts';

import { Company } from '../../../platform/companies/entities/company.entity';
import { Policy } from '../../policies/entities/policy.entity';
import { PolicyVersion } from '../../policies/entities/policy-version.entity';
import { PolicyTransactionChange } from './policy-transaction-change.entity';
import { PolicyTransactionEvent } from './policy-transaction-event.entity';

@Entity('policy_transactions')
@Unique('UQ_policy_transaction_no', ['company_id', 'transaction_no'])
@Unique('UQ_policy_transaction_idempotency', ['company_id', 'idempotency_key'])
@Index('IDX_policy_transactions_company_type_stage', [
  'company_id',
  'transaction_type',
  'stage',
])
export class PolicyTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'varchar', length: 80 })
  transaction_no: string;

  @Column({ type: 'varchar', length: 30 })
  transaction_type: PolicyTransactionType;

  @Column({ type: 'varchar', length: 40, default: 'DRAFT' })
  stage: PolicyTransactionStage;

  @Column({ type: 'varchar', length: 40, default: 'NOT_EVALUATED' })
  approval_status: WorkflowApprovalStatus;

  @Column({ type: 'varchar', length: 40, default: 'NOT_EVALUATED' })
  payment_status: WorkflowPaymentStatus;

  @Column({ type: 'varchar', length: 40, default: 'NOT_READY' })
  submission_status: WorkflowSubmissionStatus;

  @Column({ type: 'uuid' })
  source_policy_id: string;

  @Column({ type: 'uuid' })
  source_policy_version_id: string;

  @Column({ type: 'int' })
  source_policy_version_no: number;

  @Column({ type: 'jsonb' })
  source_policy_snapshot: Record<string, unknown>;

  @Column({ type: 'varchar', length: 64 })
  source_policy_snapshot_hash: string;

  @Column({ type: 'date' })
  effective_date: string;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'uuid' })
  requested_by: string;

  @CreateDateColumn({ type: 'timestamptz' })
  requested_at: Date;

  @Column({ type: 'uuid', nullable: true })
  completed_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  completed_at: Date | null;

  @Column({ type: 'boolean', default: false })
  approval_required: boolean;

  @Column({ type: 'boolean', default: false })
  payment_required: boolean;

  @Column({ type: 'varchar', length: 20, default: 'NONE' })
  premium_effect: PolicyTransactionPremiumEffect;

  @Column({ type: 'numeric', precision: 20, scale: 4, default: 0 })
  additional_premium: string;

  @Column({ type: 'numeric', precision: 20, scale: 4, default: 0 })
  return_premium: string;

  @Column({ type: 'numeric', precision: 20, scale: 4, default: 0 })
  net_premium_difference: string;

  @Column({ type: 'numeric', precision: 20, scale: 4, default: 0 })
  tax_difference: string;

  @Column({ type: 'numeric', precision: 20, scale: 4, default: 0 })
  commission_difference: string;

  @Column({ type: 'varchar', length: 3 })
  currency_code: string;

  @Column({ type: 'jsonb', nullable: true })
  pricing_snapshot: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  pricing_snapshot_hash: string | null;

  @Column({ type: 'jsonb', nullable: true })
  proposed_policy_snapshot: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  proposed_policy_snapshot_hash: string | null;

  @Column({ type: 'uuid', nullable: true })
  active_approval_request_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  active_invoice_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  active_refund_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  tiramis_tracking_id: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  tiramis_transaction_id: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  tiramis_request_id: string | null;

  @Column({ type: 'jsonb', nullable: true })
  regulatory_response: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  regulatory_response_hash: string | null;

  @Column({ type: 'uuid', nullable: true })
  target_policy_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  target_policy_version_id: string | null;

  @Column({ type: 'int', default: 1 })
  state_version: number;

  @Column({ type: 'varchar', length: 180, nullable: true })
  idempotency_key: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  last_command: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @Column({ type: 'uuid', nullable: true })
  cancelled_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  cancelled_at: Date | null;

  @Column({ type: 'text', nullable: true })
  cancellation_reason: string | null;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @ManyToOne(() => Policy, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'source_policy_id' })
  source_policy: Policy;

  @ManyToOne(() => PolicyVersion, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'source_policy_version_id' })
  source_policy_version: PolicyVersion;

  @ManyToOne(() => Policy, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'target_policy_id' })
  target_policy: Policy | null;

  @ManyToOne(() => PolicyVersion, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'target_policy_version_id' })
  target_policy_version: PolicyVersion | null;

  @OneToMany(() => PolicyTransactionChange, (change) => change.policy_transaction)
  changes: PolicyTransactionChange[];

  @OneToMany(() => PolicyTransactionEvent, (event) => event.policy_transaction)
  events: PolicyTransactionEvent[];
}
