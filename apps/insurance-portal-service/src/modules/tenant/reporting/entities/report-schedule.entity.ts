import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import {
  ReportDeliveryChannel,
  ReportFormat,
  ReportScheduleStatus,
} from '../enums/reporting.enums';

@Entity('report_schedules')
export class ReportSchedule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid' })
  definition_id: string;

  @Column({ type: 'uuid', nullable: true })
  created_by!: string | null;

  @Column({ length: 160 })
  name: string;

  @Column({
    type: 'enum',
    enum: ReportScheduleStatus,
    default: ReportScheduleStatus.ACTIVE,
  })
  status: ReportScheduleStatus;

  @Column({ length: 120 })
  cron_expression: string;

  @Column({ length: 60, default: 'Africa/Dar_es_Salaam' })
  timezone: string;

  @Column({ type: 'enum', enum: ReportFormat })
  format: ReportFormat;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  recipient_emails!: string[];

  @Column({ type: 'jsonb', nullable: true })
  filters!: Record<string, unknown> | null;

  @Column({ type: 'timestamptz', nullable: true })
  next_run_at!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  last_run_at!: Date | null;

  @Column({ type: 'uuid', nullable: true })
  last_job_id!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  report_code!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  parameter_payload!: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  parameter_hash!: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  frequency!: string | null;

  @Column({
    type: 'enum',
    enum: ReportDeliveryChannel,
    default: ReportDeliveryChannel.DOWNLOAD,
  })
  delivery_channel!: ReportDeliveryChannel;

  @Column({ type: 'int', nullable: true })
  retention_days!: number | null;

  @Column({ type: 'int', default: 0 })
  failure_count!: number;

  @Column({ type: 'timestamptz', nullable: true })
  last_failure_at!: Date | null;

  @Column({ type: 'text', nullable: true })
  last_failure_reason!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  verified_smtp_at!: Date | null;

  @Column({ type: 'uuid', nullable: true })
  run_as_user_id!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  last_delivery_attempt_at!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at!: Date | null;
}
