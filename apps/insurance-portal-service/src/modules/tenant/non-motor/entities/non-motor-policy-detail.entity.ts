import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SubjectMatter } from './subject-matter.entity';
import { Policy } from '../../policies/entities/policy.entity';
import { PolicyRisk } from '../../policies/entities/policy-risk.entity';

@Entity('non_motor_policy_details')
@Index('IDX_nmpd_policy_id', ['policy_id'])
@Index('IDX_nmpd_policy_risk_id', ['policy_risk_id'])
@Index('IDX_nmpd_subject_matter_id', ['subject_matter_id'])
export class NonMotorPolicyDetail {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  policy_id: string;

  @Column({ type: 'uuid' })
  policy_risk_id: string;

  @Column({ type: 'uuid' })
  subject_matter_id: string;

  @Column({ type: 'text', nullable: true })
  cover_description: string | null;

  @Column({ type: 'text', nullable: true })
  risk_location: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 2, nullable: true })
  insured_value: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 2, nullable: true })
  limit_of_liability: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => SubjectMatter, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subject_matter_id' })
  subject_matter: SubjectMatter;

  @ManyToOne(() => Policy, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'policy_id' })
  policy: Policy;

  @ManyToOne(() => PolicyRisk, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'policy_risk_id' })
  policy_risk: PolicyRisk;
}
