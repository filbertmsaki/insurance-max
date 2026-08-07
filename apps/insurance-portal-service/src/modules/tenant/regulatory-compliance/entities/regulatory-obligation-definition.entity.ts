import {
  RegulatoryFrequency,
  RegulatoryObligationType,
} from '@insurance-max/contracts';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('regulatory_obligation_definitions')
export class RegulatoryObligationDefinition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid' })
  authority_profile_id: string;

  @Column({ type: 'varchar', length: 80 })
  obligation_code: string;

  @Column({ type: 'varchar', length: 250 })
  obligation_name: string;

  @Column({ type: 'varchar', length: 40 })
  obligation_type: RegulatoryObligationType;

  @Column({ type: 'varchar', length: 40 })
  frequency: RegulatoryFrequency;

  @Column({ type: 'date' })
  effective_from: string;

  @Column({ type: 'date', nullable: true })
  effective_to!: string | null;

  @Column({ type: 'jsonb' })
  due_date_rule: Record<string, unknown>;

  @Column({ type: 'int', array: true, default: () => 'ARRAY[30,14,7,1]' })
  warning_days: number[];

  @Column({ type: 'varchar', length: 100, nullable: true })
  report_code!: string | null;

  @Column({ type: 'boolean', default: true })
  requires_approval: boolean;

  @Column({ type: 'boolean', default: true })
  requires_submission_evidence: boolean;

  @Column({ type: 'boolean', default: true })
  requires_reconciliation: boolean;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ type: 'int', default: 1 })
  version_number: number;

  @Column({ type: 'jsonb' })
  definition_snapshot: Record<string, unknown>;

  @Column({ type: 'varchar', length: 64 })
  definition_snapshot_hash: string;

  @Column({ type: 'uuid' })
  created_by: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
