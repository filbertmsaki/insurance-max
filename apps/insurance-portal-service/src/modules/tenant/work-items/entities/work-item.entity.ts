import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('work_items')
@Index('IDX_work_items_company_status', ['company_id', 'status', 'due_at'])
export class WorkItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  work_item_no: string | null;

  @Column({ type: 'uuid', nullable: true })
  branch_id: string | null;

  @Column({ type: 'varchar', length: 50 })
  domain: string;

  @Column({ type: 'varchar', length: 80 })
  resource_type: string;

  @Column({ type: 'uuid' })
  resource_id: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  work_item_type: string | null;

  @Column({ type: 'varchar', length: 20, default: 'USER' })
  assignment_type: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  assigned_team: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  queue_code: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  source_module: string | null;

  @Column({ type: 'uuid', nullable: true })
  source_record_id: string | null;

  @Column({ type: 'int', nullable: true })
  source_record_version: number | null;

  @Column({ type: 'varchar', length: 180, nullable: true })
  idempotency_key: string | null;

  @Column({ type: 'varchar', length: 180 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 20, default: 'MEDIUM' })
  priority: string;

  @Column({ type: 'varchar', length: 20, default: 'OPEN' })
  status: string;

  @Column({ type: 'varchar', length: 30, default: 'ON_TRACK' })
  sla_status: string;

  @Column({ type: 'uuid', nullable: true })
  assigned_user_id: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  assigned_role: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  deep_link: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  due_at: Date | null;

  @Column({ type: 'varchar', length: 180, nullable: true })
  dedupe_key: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  claimed_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  started_at: Date | null;

  @Column({ type: 'uuid', nullable: true })
  completed_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  completed_at: Date | null;

  @Column({ type: 'uuid', nullable: true })
  cancelled_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  cancelled_at: Date | null;

  @Column({ type: 'text', nullable: true })
  cancellation_reason: string | null;

  @Column({ type: 'uuid', nullable: true })
  delegated_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  delegated_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  warning_sent_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  escalated_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
