import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import {
  ReportDeliveryStatus,
  ReportFormat,
  ReportJobStatus,
} from '../enums/reporting.enums';

@Entity('report_jobs')
export class ReportJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid', nullable: true })
  schedule_id!: string | null;

  @Column({ type: 'uuid' })
  definition_id: string;

  @Column({ type: 'uuid', nullable: true })
  requested_by!: string | null;

  @Column({
    type: 'enum',
    enum: ReportJobStatus,
    default: ReportJobStatus.PENDING,
  })
  status: ReportJobStatus;

  @Column({ type: 'enum', enum: ReportFormat })
  format: ReportFormat;

  @Column({ length: 120, unique: true })
  execution_key: string;

  @Column({ type: 'jsonb', nullable: true })
  filters!: Record<string, unknown> | null;

  @Column({
    type: 'enum',
    enum: ReportDeliveryStatus,
    default: ReportDeliveryStatus.PENDING,
  })
  delivery_status: ReportDeliveryStatus;

  @Column({ type: 'timestamptz', nullable: true })
  claimed_at!: Date | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  claimed_by!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  started_at!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  completed_at!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  failed_at!: Date | null;

  @Column({ type: 'text', nullable: true })
  error_message!: string | null;

  @Column({ type: 'text', nullable: true })
  delivery_error!: string | null;

  @Column({ type: 'uuid', nullable: true })
  artifact_id!: string | null;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  job_no!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  report_code!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  parameter_payload!: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  parameter_hash!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  source_cutoff_at!: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  execution_context!: Record<string, unknown> | null;

  @Column({ type: 'int', default: 0 })
  progress_percent!: number;

  @Column({ type: 'bigint', nullable: true })
  row_count!: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  failure_code!: string | null;

  @Column({ type: 'text', nullable: true })
  safe_error_message!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
