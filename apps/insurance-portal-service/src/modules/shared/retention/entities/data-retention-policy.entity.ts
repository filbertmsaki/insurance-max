import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

import {
  DataRetentionAction,
  DataRetentionStatus,
} from '@insurance-max/contracts';

@Entity('data_retention_policies')
@Index('IDX_data_retention_company_status', ['company_id', 'status'])
@Index('UQ_data_retention_policy_version', ['company_id', 'policy_code', 'version_number'], {
  unique: true,
})
export class DataRetentionPolicy {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  company_id: string | null;

  @Column({ type: 'varchar', length: 80 })
  policy_code: string;

  @Column({ type: 'varchar', length: 160 })
  policy_name: string;

  @Column({ type: 'varchar', length: 120 })
  resource_type: string;

  @Column({ type: 'integer', default: 1 })
  version_number: number;

  @Column({
    type: 'varchar',
    length: 20,
    default: DataRetentionStatus.ACTIVE,
  })
  status: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: DataRetentionAction.RETAIN,
  })
  action: string;

  @Column({ type: 'integer', default: 365 })
  retention_days: number;

  @Column({ type: 'boolean', default: true })
  dry_run_default: boolean;

  @Column({ type: 'boolean', default: false })
  archive_before_delete: boolean;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  rules: Record<string, unknown>;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
