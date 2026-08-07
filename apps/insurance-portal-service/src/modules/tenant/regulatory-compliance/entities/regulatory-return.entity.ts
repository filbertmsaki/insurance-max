import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { RegulatoryReturnStatus } from '../enums/regulatory.enums';

@Entity('regulatory_returns')
export class RegulatoryReturn {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid' })
  definition_id: string;

  @Column({ type: 'uuid', nullable: true })
  obligation_id!: string | null;

  @Column({ length: 60, unique: true })
  return_no: string;

  @Column({
    type: 'enum',
    enum: RegulatoryReturnStatus,
    default: RegulatoryReturnStatus.DRAFT,
  })
  status: RegulatoryReturnStatus;

  @Column({ type: 'date' })
  period_start: string;

  @Column({ type: 'date' })
  period_end: string;

  @Column({ type: 'timestamptz', nullable: true })
  due_at!: Date | null;

  @Column({ length: 10, default: 'TZS' })
  currency: string;

  @Column({ type: 'uuid', nullable: true })
  prepared_by!: string | null;

  @Column({ type: 'uuid', nullable: true })
  approved_by!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  approved_at!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  submitted_at!: Date | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  submission_reference!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  data!: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @Column({ type: 'uuid', nullable: true })
  obligation_instance_id!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  return_code!: string | null;

  @Column({ type: 'int', default: 1 })
  version_number!: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  report_definition_code!: string | null;

  @Column({ type: 'int', nullable: true })
  report_definition_version!: number | null;

  @Column({ type: 'varchar', length: 3, nullable: true })
  currency_code!: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  parameters!: Record<string, unknown>;

  @Column({ type: 'varchar', length: 64, nullable: true })
  parameters_hash!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  source_cutoff_at!: Date | null;

  @Column({ type: 'bigint', nullable: true })
  source_projection_sequence!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  return_snapshot!: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  return_snapshot_hash!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  validation_results!: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 40, default: 'NOT_CHECKED' })
  reconciliation_status!: string;

  @Column({ type: 'jsonb', nullable: true })
  reconciliation_summary!: Record<string, unknown> | null;

  @Column({ type: 'uuid', nullable: true })
  report_job_id!: string | null;

  @Column({ type: 'uuid', nullable: true })
  artifact_id!: string | null;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  prepared_at!: Date;

  @Column({ type: 'uuid', nullable: true })
  submitted_for_review_by!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  submitted_for_review_at!: Date | null;

  @Column({ type: 'uuid', nullable: true })
  rejected_by!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  rejected_at!: Date | null;

  @Column({ type: 'text', nullable: true })
  rejection_reason!: string | null;

  @Column({ type: 'uuid', nullable: true })
  supersedes_return_id!: string | null;

  @Column({ type: 'int', default: 1 })
  state_version!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at!: Date | null;
}
