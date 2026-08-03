import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { ComplaintStatus } from '../enums/claim.enums';

@Entity('complaint_status_history')
export class ComplaintStatusHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  complaint_id: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  old_status: ComplaintStatus | null;

  @Column({ type: 'varchar', length: 30 })
  new_status: ComplaintStatus;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'uuid', nullable: true })
  changed_by: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
