import {
  LevyAssessmentStatus,
  RegulatoryReconciliationStatus,
} from '@insurance-max/contracts';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('regulatory_levy_assessments')
export class RegulatoryLevyAssessment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid', nullable: true })
  obligation_instance_id!: string | null;

  @Column({ type: 'uuid' })
  levy_rule_id: string;

  @Column({ type: 'varchar', length: 100 })
  assessment_no: string;

  @Column({ type: 'date' })
  period_start: string;

  @Column({ type: 'date' })
  period_end: string;

  @Column({ type: 'varchar', length: 50, default: 'DRAFT' })
  status: LevyAssessmentStatus;

  @Column({ type: 'numeric', precision: 20, scale: 4 })
  basis_amount: string;

  @Column({ type: 'numeric', precision: 18, scale: 10 })
  rate_value: string;

  @Column({ type: 'numeric', precision: 20, scale: 4 })
  assessed_amount: string;

  @Column({ type: 'numeric', precision: 20, scale: 4, default: 0 })
  paid_amount: string;

  @Column({ type: 'numeric', precision: 20, scale: 4 })
  outstanding_amount: string;

  @Column({ type: 'varchar', length: 3 })
  currency_code: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  source_report_code!: string | null;

  @Column({ type: 'uuid', nullable: true })
  source_report_job_id!: string | null;

  @Column({ type: 'jsonb' })
  calculation_snapshot: Record<string, unknown>;

  @Column({ type: 'varchar', length: 64 })
  calculation_snapshot_hash: string;

  @Column({ type: 'uuid', nullable: true })
  active_invoice_id!: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  finance_payment_reference!: string | null;

  @Column({ type: 'varchar', length: 40, default: 'NOT_CHECKED' })
  reconciliation_status: RegulatoryReconciliationStatus;

  @Column({ type: 'uuid' })
  prepared_by: string;

  @Column({ type: 'uuid', nullable: true })
  approved_by!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  approved_at!: Date | null;

  @Column({ type: 'int', default: 1 })
  state_version: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
