import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('regulatory_submission_events')
export class RegulatorySubmissionEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid', nullable: true })
  return_id!: string | null;

  @Column({ type: 'uuid', nullable: true })
  levy_return_id!: string | null;

  @Column({ length: 60 })
  event_type: string;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  event_at: Date;

  @Column({ type: 'uuid', nullable: true })
  actor_id!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
