import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { ClaimServiceAssignmentStatus } from '../enums/claim.enums';

@Entity('claim_service_assignments')
export class ClaimServiceAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid' })
  claim_id: string;

  @Column({ type: 'uuid', nullable: true })
  provider_company_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  assigned_user_id: string | null;

  @Column({ type: 'varchar', length: 80 })
  service_type: string;

  @Column({ type: 'varchar', length: 80 })
  assignment_no: string;

  @Column({ type: 'text', nullable: true })
  instructions: string | null;

  @Column({ type: 'timestamptz' })
  assigned_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  due_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  accepted_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  declined_at: Date | null;

  @Column({ type: 'text', nullable: true })
  decline_reason: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  report_submitted_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  completed_at: Date | null;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  estimated_fee: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  approved_fee: string;

  @Column({ type: 'varchar', length: 10 })
  currency: string;

  @Column({
    type: 'varchar',
    length: 30,
    default: ClaimServiceAssignmentStatus.ASSIGNED,
  })
  status: ClaimServiceAssignmentStatus;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
