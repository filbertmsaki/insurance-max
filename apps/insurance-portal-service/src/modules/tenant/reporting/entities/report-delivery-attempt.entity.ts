import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('report_delivery_attempts')
export class ReportDeliveryAttempt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  report_job_id: string;

  @Column({ type: 'uuid', nullable: true })
  artifact_id!: string | null;

  @Column({ type: 'varchar', length: 40 })
  channel: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  recipient!: string | null;

  @Column({ type: 'int', default: 1 })
  attempt_no: number;

  @Column({ type: 'varchar', length: 40 })
  status: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  failure_code!: string | null;

  @Column({ type: 'text', nullable: true })
  failure_message!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  attempted_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  completed_at!: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;
}
