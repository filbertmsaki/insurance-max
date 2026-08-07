import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('communication_threads')
export class CommunicationThread {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'varchar', length: 100 })
  thread_no: string;

  @Column({ type: 'varchar', length: 40, default: 'GENERAL' })
  thread_type: string;

  @Column({ type: 'varchar', length: 255 })
  subject: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  resource_type: string | null;

  @Column({ type: 'uuid', nullable: true })
  resource_id: string | null;

  @Column({ type: 'boolean', default: false })
  customer_visible: boolean;

  @Column({ type: 'boolean', default: false })
  intermediary_visible: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  closed_at: Date | null;

  @Column({ type: 'uuid', nullable: true })
  closed_by: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
