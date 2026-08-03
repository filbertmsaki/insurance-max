import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { ClaimSlaStatus } from '../enums/claim.enums';

@Entity('claim_sla_events')
export class ClaimSlaEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid', nullable: true })
  branch_id: string | null;

  @Column({ type: 'uuid' })
  claim_id: string;

  @Column({ type: 'varchar', length: 80 })
  event_type: string;

  @Column({ type: 'timestamptz' })
  started_at: Date;

  @Column({ type: 'timestamptz' })
  due_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  warning_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  completed_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  breached_at: Date | null;

  @Column({ type: 'varchar', length: 30, default: ClaimSlaStatus.PENDING })
  status: ClaimSlaStatus;

  @Column({ type: 'jsonb', nullable: true })
  rule_snapshot: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
