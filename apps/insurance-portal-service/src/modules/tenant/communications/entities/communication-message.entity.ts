import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('communication_messages')
export class CommunicationMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid' })
  thread_id: string;

  @Column({ type: 'varchar', length: 20 })
  direction: string;

  @Column({ type: 'varchar', length: 30, default: 'SENT' })
  status: string;

  @Column({ type: 'varchar', length: 20, default: 'IN_APP' })
  channel: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  subject: string | null;

  @Column({ type: 'text', nullable: true })
  body_text: string | null;

  @Column({ type: 'text', nullable: true })
  body_html: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  sender_type: string | null;

  @Column({ type: 'uuid', nullable: true })
  sender_id: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  recipient_type: string | null;

  @Column({ type: 'uuid', nullable: true })
  recipient_id: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  provider: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  provider_message_id: string | null;

  @Column({ type: 'boolean', default: false })
  internal_only: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
