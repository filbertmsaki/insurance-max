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

  @Column({ length: 80, nullable: true })
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

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
