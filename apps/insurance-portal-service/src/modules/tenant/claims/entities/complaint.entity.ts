import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import {
  ComplaintPriority,
  ComplaintStatus,
} from '../enums/claim.enums';

@Entity('complaints')
export class Complaint {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid', nullable: true })
  branch_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  claim_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  policy_id: string | null;

  @Column({ type: 'uuid' })
  customer_id: string;

  @Column({ type: 'varchar', length: 80 })
  complaint_no: string;

  @Column({ type: 'varchar', length: 100 })
  category: string;

  @Column({ type: 'varchar', length: 180 })
  subject: string;

  @Column({ type: 'text' })
  description: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: ComplaintPriority.MEDIUM,
  })
  priority: ComplaintPriority;

  @Column({ type: 'varchar', length: 30, default: ComplaintStatus.OPEN })
  status: ComplaintStatus;

  @Column({ type: 'varchar', length: 100 })
  reported_channel: string;

  @Column({ type: 'uuid', nullable: true })
  assigned_user_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  acknowledged_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  acknowledged_at: Date | null;

  @Column({ type: 'text', nullable: true })
  resolution: string | null;

  @Column({ type: 'uuid', nullable: true })
  resolved_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  resolved_at: Date | null;

  @Column({ type: 'uuid', nullable: true })
  escalated_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  escalated_at: Date | null;

  @Column({ type: 'text', nullable: true })
  escalation_reason: string | null;

  @Column({ type: 'uuid', nullable: true })
  closed_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  closed_at: Date | null;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
