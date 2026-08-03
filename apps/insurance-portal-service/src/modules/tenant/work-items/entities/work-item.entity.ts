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

  @Column({ type: 'uuid', nullable: true })
  branch_id: string | null;

  @Column({ type: 'varchar', length: 50 })
  domain: string;

  @Column({ type: 'varchar', length: 80 })
  resource_type: string;

  @Column({ type: 'uuid' })
  resource_id: string;

  @Column({ type: 'varchar', length: 180 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 20, default: 'MEDIUM' })
  priority: string;

  @Column({ type: 'varchar', length: 20, default: 'OPEN' })
  status: string;

  @Column({ type: 'uuid', nullable: true })
  assigned_user_id: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  assigned_role: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  due_at: Date | null;

  @Column({ type: 'varchar', length: 180, nullable: true })
  dedupe_key: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @Column({ type: 'uuid', nullable: true })
  completed_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  completed_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
