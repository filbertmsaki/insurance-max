import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { ReinsuranceDirection } from '@insurance-max/contracts';

import {
  TreatyForm,
  TreatyStatus,
  TreatyType,
} from '../enums/reinsurance.enums';
import { ReinsuranceTreatyParticipant } from './reinsurance-treaty-participant.entity';
import { ReinsuranceTreatySection } from './reinsurance-treaty-section.entity';

@Entity('reinsurance_treaties')
@Index('IDX_reinsurance_treaty_company', ['company_id', 'status'])
export class ReinsuranceTreaty {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid', nullable: true })
  branch_id: string | null;

  @Column({ type: 'varchar', length: 60 })
  treaty_no: string;

  @Column({ type: 'varchar', length: 180 })
  treaty_name: string;

  @Column({ type: 'varchar', length: 40 })
  treaty_type: TreatyType;

  @Column({ type: 'varchar', length: 60 })
  treaty_form: TreatyForm;

  @Column({ type: 'date' })
  effective_from: string;

  @Column({ type: 'date' })
  effective_to: string;

  @Column({ type: 'varchar', length: 10, default: 'TZS' })
  currency: string;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  total_capacity: string;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  company_retention: string;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  aggregate_limit: string;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  minimum_deposit_premium: string;

  @Column({ type: 'int', default: 0 })
  reinstatement_count: number;

  @Column({ type: 'varchar', length: 30, default: TreatyStatus.DRAFT })
  status: TreatyStatus;

  @Column({ type: 'varchar', length: 120, nullable: true })
  agreement_reference: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  agreement_document_url: string | null;

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
  activated_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  activated_at: Date | null;

  @Column({ type: 'uuid', nullable: true })
  rejected_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  rejected_at: Date | null;

  @Column({ type: 'text', nullable: true })
  rejection_reason: string | null;

  @Column({ type: 'uuid', nullable: true })
  suspended_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  suspended_at: Date | null;

  @Column({ type: 'text', nullable: true })
  suspension_reason: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ type: 'uuid', nullable: true })
  program_id: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: ReinsuranceDirection.OUTWARD,
  })
  direction: ReinsuranceDirection;

  @Column({ type: 'varchar', length: 30, nullable: true })
  territory: string | null;

  @Column({ type: 'varchar', length: 30, default: 'UNREGISTERED' })
  regulatory_status: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

  @OneToMany(() => ReinsuranceTreatySection, (section) => section.treaty)
  sections: ReinsuranceTreatySection[];

  @OneToMany(
    () => ReinsuranceTreatyParticipant,
    (participant) => participant.treaty,
  )
  participants: ReinsuranceTreatyParticipant[];
}
