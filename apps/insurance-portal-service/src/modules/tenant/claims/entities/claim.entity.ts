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

import { Branch } from '../../branches/entities/branch.entity';
import { Customer } from '../../customers/entities/customer.entity';
import { Policy } from '../../policies/entities/policy.entity';
import { PolicyRisk } from '../../policies/entities/policy-risk.entity';
import { User } from '../../users/entities/user.entity';
import {
  ClaimCoverageStatus,
  ClaimFraudStatus,
  ClaimLiabilityStatus,
  ClaimPriority,
  ClaimSettlementStatus,
  ClaimStage,
  ClaimStatus,
} from '../enums/claim.enums';
import { ClaimAssessment } from './claim-assessment.entity';
import { ClaimClaimant } from './claim-claimant.entity';
import { ClaimDocument } from './claim-document.entity';
import { ClaimPayment } from './claim-payment.entity';
import { ClaimReserve } from './claim-reserve.entity';
import { ClaimStatusHistory } from './claim-status-history.entity';
import { TiramisTrackableClaimEntity } from './tiramis-trackable-claim.entity';

@Entity('claims')
@Index('IDX_claims_company_status', ['company_id', 'status', 'created_at'])
@Index('IDX_claims_assigned_user', ['company_id', 'assigned_user_id', 'status'])
export class InsuranceClaim extends TiramisTrackableClaimEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid' })
  insurer_company_id: string;

  @Column({ type: 'uuid', nullable: true })
  intermediary_company_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  reported_by_company_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  branch_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  reported_branch_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  sale_point_id: string | null;

  @Column({ type: 'uuid' })
  policy_id: string;

  @Column({ type: 'uuid', nullable: true })
  policy_risk_id: string | null;

  @Column({ type: 'uuid' })
  customer_id: string;

  @Column({ type: 'uuid', nullable: true })
  assigned_user_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  reported_by_user_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @Column({ type: 'varchar', length: 60 })
  claim_no: string;

  @Column({ type: 'varchar', length: 80 })
  claim_notification_number: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  claim_reference_number: string | null;

  @Column({ type: 'varchar', length: 100 })
  cover_note_reference_number: string;

  @Column({ type: 'timestamptz' })
  claim_report_date: Date;

  @Column({ type: 'timestamptz' })
  loss_date: Date;

  @Column({ type: 'varchar', length: 150 })
  loss_nature: string;

  @Column({ type: 'varchar', length: 100 })
  loss_type: string;

  @Column({ type: 'text' })
  loss_location: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'text', nullable: true })
  cause_of_loss: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  police_report_number: string | null;

  @Column({ type: 'varchar', length: 1, default: 'N' })
  claim_form_dully_filled: 'Y' | 'N';

  @Column({ type: 'varchar', length: 150, nullable: true })
  officer_name: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  officer_title: string | null;

  @Column({ type: 'varchar', length: 10, default: 'TZS' })
  currency_code: string;

  @Column({ type: 'numeric', precision: 18, scale: 6, default: 1 })
  exchange_rate: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  estimated_amount: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  approved_amount: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  paid_amount: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  outstanding_reserve: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  recovery_expected: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  recovery_received: string;

  @Column({ type: 'varchar', length: 30, default: ClaimStatus.NOTIFIED })
  status: ClaimStatus;

  @Column({ type: 'varchar', length: 20, default: ClaimPriority.MEDIUM })
  priority: ClaimPriority;

  @Column({
    type: 'varchar',
    length: 30,
    default: ClaimLiabilityStatus.PENDING,
  })
  liability_status: ClaimLiabilityStatus;

  @Column({ type: 'boolean', default: false })
  fraud_indicator: boolean;

  @Column({ type: 'boolean', default: false })
  litigation_indicator: boolean;

  @Column({ type: 'uuid', nullable: true })
  closed_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  closed_at: Date | null;

  @Column({ type: 'text', nullable: true })
  closure_reason: string | null;

  @Column({
    type: 'varchar',
    length: 40,
    default: ClaimStage.NOTIFICATION_PENDING,
  })
  claim_stage: ClaimStage;

  @Column({
    type: 'varchar',
    length: 40,
    default: ClaimCoverageStatus.NOT_EVALUATED,
  })
  coverage_status: ClaimCoverageStatus;

  @Column({
    type: 'varchar',
    length: 40,
    default: ClaimSettlementStatus.NOT_READY,
  })
  settlement_status: ClaimSettlementStatus;

  @Column({
    type: 'varchar',
    length: 40,
    default: ClaimFraudStatus.NOT_SCREENED,
  })
  fraud_status: ClaimFraudStatus;

  @Column({ type: 'uuid', nullable: true })
  policy_version_id: string | null;

  @Column({ type: 'int', nullable: true })
  policy_version_number: number | null;

  @Column({ type: 'jsonb', nullable: true })
  policy_snapshot: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  policy_snapshot_hash: string | null;

  @Column({ type: 'jsonb', nullable: true })
  coverage_snapshot: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  coverage_snapshot_hash: string | null;

  @Column({ type: 'jsonb', nullable: true })
  incident_snapshot: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  incident_snapshot_hash: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  claimant_manifest_hash: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  duplicate_fingerprint: string | null;

  @Column({ type: 'uuid', nullable: true })
  possible_duplicate_of_id: string | null;

  @Column({ type: 'text', nullable: true })
  duplicate_override_reason: string | null;

  @Column({ type: 'uuid', nullable: true })
  duplicate_override_by: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  gross_case_reserve: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  gross_incurred_amount: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  expense_paid_amount: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  indemnity_paid_amount: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  total_recovery_expected: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  total_recovery_received: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  net_incurred_amount: string;

  @Column({ type: 'uuid', nullable: true })
  current_assessment_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  current_discharge_voucher_id: string | null;

  @Column({ type: 'varchar', length: 40, default: 'INTERNAL' })
  source_channel: string;

  @Column({ type: 'int', default: 1 })
  state_version: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

  @ManyToOne(() => Policy, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'policy_id' })
  policy: Policy;

  @ManyToOne(() => PolicyRisk, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'policy_risk_id' })
  policy_risk: PolicyRisk | null;

  @ManyToOne(() => Customer, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @ManyToOne(() => Branch, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'branch_id' })
  branch: Branch | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assigned_user_id' })
  assigned_user: User | null;

  @OneToMany(() => ClaimClaimant, (claimant) => claimant.claim)
  claimants: ClaimClaimant[];

  @OneToMany(() => ClaimDocument, (document) => document.claim)
  documents: ClaimDocument[];

  @OneToMany(() => ClaimReserve, (reserve) => reserve.claim)
  reserves: ClaimReserve[];

  @OneToMany(() => ClaimAssessment, (assessment) => assessment.claim)
  assessments: ClaimAssessment[];

  @OneToMany(() => ClaimPayment, (payment) => payment.claim)
  payments: ClaimPayment[];

  @OneToMany(() => ClaimStatusHistory, (history) => history.claim)
  status_history: ClaimStatusHistory[];
}
