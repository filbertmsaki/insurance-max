import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { Complaint } from './complaint.entity';

@Entity('complaint_appeals')
@Unique('UQ_complaint_appeal_no', ['company_id', 'appeal_no'])
export class ComplaintAppeal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid' })
  complaint_id: string;

  @Column({ type: 'varchar', length: 80 })
  appeal_no: string;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'uuid' })
  filed_by: string;

  @CreateDateColumn({ type: 'timestamptz' })
  filed_at: Date;

  @Column({ type: 'varchar', length: 30, nullable: true })
  decision: string | null;

  @Column({ type: 'uuid', nullable: true })
  decided_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  decided_at: Date | null;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  created_at: Date;

  @ManyToOne(() => Complaint, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'complaint_id' })
  complaint: Complaint;
}
