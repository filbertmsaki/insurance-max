import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { PortalTiraSubmission } from './portal-tira-submission.entity';

@Entity('portal_tira_submission_events')
@Index('IDX_ptse_submission_id', ['submission_id'])
@Index('IDX_ptse_request_id', ['request_id'])
@Index('IDX_ptse_event_type', ['event_type'])
@Index('IDX_ptse_created_at', ['created_at'])
export class PortalTiraSubmissionEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  submission_id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  tiramis_transaction_id: string | null;

  @Column({ type: 'varchar', length: 100 })
  request_id: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  response_id: string | null;

  @Column({ type: 'varchar', length: 100 })
  event_type: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  status_code: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  status_description: string | null;

  @Column({ type: 'text', nullable: true })
  error_message: string | null;

  @Column({ type: 'jsonb', nullable: true })
  payload: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @ManyToOne(() => PortalTiraSubmission, (submission) => submission.events, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'submission_id' })
  submission: PortalTiraSubmission;
}
