import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { ClaimAssessmentStatus } from '../enums/claim.enums';
import { InsuranceClaim } from './claim.entity';
import { TiramisTrackableClaimEntity } from './tiramis-trackable-claim.entity';

@Entity('claim_assessments')
export class ClaimAssessment extends TiramisTrackableClaimEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid', nullable: true })
  branch_id: string | null;

  @Column({ type: 'uuid' })
  claim_id: string;

  @Column({ type: 'uuid', nullable: true })
  service_assignment_id: string | null;

  @Column({ type: 'varchar', length: 80 })
  claim_assessment_number: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  claim_intimation_number: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  claim_reference_number: string | null;

  @Column({ type: 'varchar', length: 100 })
  cover_note_reference_number: string;

  @Column({ type: 'timestamptz' })
  assessment_received_date: Date;

  @Column({ type: 'text' })
  assessment_report_summary: string;

  @Column({ type: 'varchar', length: 10 })
  currency_code: string;

  @Column({ type: 'numeric', precision: 18, scale: 6, default: 1 })
  exchange_rate: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  assessment_amount: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  approved_claim_amount: string;

  @Column({ type: 'timestamptz', nullable: true })
  claim_approval_date: Date | null;

  @Column({ type: 'varchar', length: 180, nullable: true })
  claim_approval_authority: string | null;

  @Column({ type: 'varchar', length: 1, default: 'N' })
  is_re_assessment: 'Y' | 'N';

  @Column({ type: 'jsonb', default: () => "'[]'" })
  claimants: Record<string, unknown>[];

  @Column({
    type: 'varchar',
    length: 30,
    default: ClaimAssessmentStatus.DRAFT,
  })
  status: ClaimAssessmentStatus;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @Column({ type: 'uuid', nullable: true })
  submitted_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  submitted_at: Date | null;

  @Column({ type: 'uuid', nullable: true })
  approved_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  approved_at: Date | null;

  @Column({ type: 'uuid', nullable: true })
  rejected_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  rejected_at: Date | null;

  @Column({ type: 'text', nullable: true })
  rejection_reason: string | null;

  @Column({ type: 'uuid', nullable: true })
  supersedes_assessment_id: string | null;

  @Column({ type: 'varchar', length: 180, nullable: true })
  assessor_name: string | null;

  @Column({ type: 'varchar', length: 180, nullable: true })
  assessor_company: string | null;

  @Column({ type: 'date', nullable: true })
  inspection_date: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  recommended_amount: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  deductible_amount: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  salvage_amount: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  contribution_amount: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  betterment_amount: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  recovery_amount: string;

  @Column({ type: 'text', nullable: true })
  remarks: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => InsuranceClaim, (claim) => claim.assessments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'claim_id' })
  claim: InsuranceClaim;
}
