import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import type { ClaimDecisionType } from '@insurance-max/contracts';

import {
  ClaimDecisionStatus,
  ClaimLiabilityStatus,
} from '../enums/claim.enums';
import { InsuranceClaim } from './claim.entity';
import { ClaimAssessment } from './claim-assessment.entity';

@Entity('claim_decisions')
@Unique('UQ_claim_decision_no', ['company_id', 'decision_no'])
export class ClaimDecision {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid' })
  claim_id: string;

  @Column({ type: 'uuid', nullable: true })
  assessment_id: string | null;

  @Column({ type: 'varchar', length: 80 })
  decision_no: string;

  @Column({ type: 'varchar', length: 40 })
  decision_type: ClaimDecisionType;

  @Column({ type: 'varchar', length: 40 })
  liability_status: ClaimLiabilityStatus;

  @Column({ type: 'numeric', precision: 18, scale: 2 })
  amount_claimed: string;

  @Column({ type: 'numeric', precision: 18, scale: 2 })
  amount_admitted: string;

  @Column({ type: 'numeric', precision: 18, scale: 2 })
  amount_declined: string;

  @Column({ type: 'varchar', length: 3 })
  currency_code: string;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'jsonb' })
  decision_snapshot: Record<string, unknown>;

  @Column({ type: 'varchar', length: 64 })
  decision_snapshot_hash: string;

  @Column({ type: 'varchar', length: 30, default: ClaimDecisionStatus.DRAFT })
  status: ClaimDecisionStatus;

  @Column({ type: 'uuid' })
  created_by: string;

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

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => InsuranceClaim, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'claim_id' })
  claim: InsuranceClaim;

  @ManyToOne(() => ClaimAssessment, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assessment_id' })
  assessment: ClaimAssessment | null;
}
