import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('regulatory_levy_rules')
export class RegulatoryLevyRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid' })
  authority_profile_id: string;

  @Column({ type: 'varchar', length: 80 })
  levy_code: string;

  @Column({ type: 'varchar', length: 200 })
  levy_name: string;

  @Column({ type: 'varchar', length: 50 })
  basis_type: string;

  @Column({ type: 'varchar', length: 30 })
  rate_type: string;

  @Column({ type: 'numeric', precision: 18, scale: 10 })
  rate_value: string;

  @Column({ type: 'numeric', precision: 20, scale: 4, nullable: true })
  minimum_amount!: string | null;

  @Column({ type: 'numeric', precision: 20, scale: 4, nullable: true })
  maximum_amount!: string | null;

  @Column({ type: 'varchar', length: 3, nullable: true })
  currency_code!: string | null;

  @Column({ type: 'date' })
  effective_from: string;

  @Column({ type: 'date', nullable: true })
  effective_to!: string | null;

  @Column({ type: 'jsonb' })
  calculation_configuration: Record<string, unknown>;

  @Column({ type: 'int', default: 1 })
  version_number: number;

  @Column({ type: 'jsonb' })
  rule_snapshot: Record<string, unknown>;

  @Column({ type: 'varchar', length: 64 })
  rule_snapshot_hash: string;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ type: 'uuid' })
  created_by: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
