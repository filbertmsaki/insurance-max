import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('signature_events')
export class SignatureEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  signature_request_id: string;

  @Column({ type: 'varchar', length: 40 })
  event_type: string;

  @Column({ type: 'uuid', nullable: true })
  actor_id: string | null;

  @Column({ type: 'varchar', length: 30 })
  actor_type: string;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'jsonb', nullable: true })
  payload: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
