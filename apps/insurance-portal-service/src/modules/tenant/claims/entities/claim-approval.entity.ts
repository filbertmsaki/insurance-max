import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { ClaimApprovalStatus, ClaimApprovalType } from '../enums/claim.enums';
import { InsuranceClaim } from './claim.entity';

/** One approval level of one submission round for a claim subject. */
@Entity('claim_approvals')
@Unique('UQ_claim_approvals_subject_round_level', [
  'subject_type',
  'subject_id',
  'round',
  'level',
])
@Index('IDX_claim_approvals_pending', ['company_id', 'status', 'approval_type'])
export class ClaimApproval {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid' })
  claim_id: string;

  @Column({ type: 'varchar', length: 30 })
  subject_type: string;

  @Column({ type: 'uuid' })
  subject_id: string;

  @Column({ type: 'varchar', length: 30 })
  approval_type: ClaimApprovalType;

  @Column({ type: 'int', default: 1 })
  round: number;

  @Column({ type: 'smallint' })
  level: number;

  @Column({ type: 'smallint' })
  required_levels: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  amount: string;

  @Column({ type: 'varchar', length: 3 })
  currency_code: string;

  @Column({ type: 'varchar', length: 20, default: ClaimApprovalStatus.PENDING })
  status: ClaimApprovalStatus;

  @Column({ type: 'uuid', nullable: true })
  limit_id: string | null;

  @Column({ type: 'text', nullable: true })
  comments: string | null;

  @Column({ type: 'uuid', nullable: true })
  submitted_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  submitted_at: Date | null;

  @Column({ type: 'uuid', nullable: true })
  acted_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  acted_at: Date | null;

  @Column({ type: 'boolean', default: false })
  admin_override: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => InsuranceClaim, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'claim_id' })
  claim: InsuranceClaim;
}
