import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('work_item_events')
export class WorkItemEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid' })
  work_item_id: string;

  @Column({ type: 'varchar', length: 30 })
  event_type: string;

  @Column({ type: 'uuid', nullable: true })
  actor_id: string | null;

  @Column({ type: 'varchar', length: 30, default: 'USER' })
  actor_type: string;

  @Column({ type: 'text', nullable: true })
  comment: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
