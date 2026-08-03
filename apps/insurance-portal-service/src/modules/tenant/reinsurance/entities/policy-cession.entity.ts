import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Policy } from '../../policies/entities/policy.entity';
import {
  ReinsuranceCessionStatus,
  ReinsuranceCessionType,
} from '../enums/reinsurance.enums';
import { PolicyCessionParticipant } from './policy-cession-participant.entity';

@Entity('policy_cessions')
export class PolicyCession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid', nullable: true })
  branch_id: string | null;

  @Column({ type: 'uuid' })
  policy_id: string;

  @Column({ type: 'uuid', nullable: true })
  policy_risk_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  treaty_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  treaty_section_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  facultative_placement_id: string | null;

  @Column({ type: 'varchar', length: 60 })
  cession_no: string;

  @Column({ type: 'varchar', length: 30 })
  cession_type: ReinsuranceCessionType;

  @Column({ type: 'date' })
  effective_from: string;

  @Column({ type: 'date' })
  effective_to: string;

  @Column({ type: 'varchar', length: 10 })
  currency: string;

  @Column({ type: 'numeric', precision: 18, scale: 6, default: 1 })
  exchange_rate: string;

  @Column({ type: 'numeric', precision: 20, scale: 2 })
  gross_sum_insured: string;

  @Column({ type: 'numeric', precision: 20, scale: 2 })
  gross_premium: string;

  @Column({ type: 'numeric', precision: 20, scale: 2 })
  retention_amount: string;

  @Column({ type: 'numeric', precision: 20, scale: 2 })
  retained_premium: string;

  @Column({ type: 'numeric', precision: 20, scale: 2 })
  ceded_sum_insured: string;

  @Column({ type: 'numeric', precision: 20, scale: 2 })
  ceded_premium: string;

  @Column({ type: 'numeric', precision: 18, scale: 10 })
  ceded_share_percent: string;

  @Column({ type: 'int', default: 1 })
  reinsurance_category: number;

  @Column({ type: 'varchar', length: 150, nullable: true })
  authorizing_officer_name: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  authorizing_officer_title: string | null;

  @Column({
    type: 'varchar',
    length: 30,
    default: ReinsuranceCessionStatus.DRAFT,
  })
  status: ReinsuranceCessionStatus;

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
  applied_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  applied_at: Date | null;

  @Column({ type: 'text', nullable: true })
  rejection_reason: string | null;

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

  @OneToMany(
    () => PolicyCessionParticipant,
    (participant) => participant.cession,
  )
  participants: PolicyCessionParticipant[];
}
