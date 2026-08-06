import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { TiramisSubmissionTrackingEntity } from '../../../tiramis/entities/tiramis-submission-tracking.entity';
import { PolicyTransaction } from '../../policy-transactions/entities/policy-transaction.entity';
import { Policy } from './policy.entity';

@Entity('policy_versions')
@Unique('UQ_policy_version', ['policy_id', 'version_number'])
export class PolicyVersion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  company_id!: string;

  @Column({ type: 'uuid' })
  policy_id!: string;

  @Column({ type: 'int' })
  version_number!: number;

  @Column({ type: 'varchar', length: 30, default: 'NEW_BUSINESS' })
  version_type!: string;

  @Column({ type: 'varchar', length: 30 })
  status!: string;

  @Column({ type: 'date' })
  effective_from!: string;

  @Column({ type: 'date' })
  effective_to!: string;

  @Column({ type: 'jsonb' })
  policy_snapshot!: Record<string, unknown>;

  @Column({ type: 'varchar', length: 64 })
  policy_snapshot_hash!: string;

  @Column({ type: 'jsonb' })
  pricing_snapshot!: Record<string, unknown>;

  @Column({ type: 'varchar', length: 64 })
  pricing_result_hash!: string;

  @Column({ type: 'jsonb' })
  customer_snapshot!: Record<string, unknown>;

  @Column({ type: 'varchar', length: 64 })
  customer_snapshot_hash!: string;

  @Column({ type: 'jsonb' })
  asset_manifest!: Record<string, unknown>;

  @Column({ type: 'varchar', length: 64 })
  asset_manifest_hash!: string;

  @Column({ type: 'uuid', nullable: true })
  tiramis_tracking_id!: string | null;

  @Column({ type: 'uuid', nullable: true })
  policy_transaction_id!: string | null;

  @Column({ type: 'uuid', nullable: true })
  supersedes_version_id!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  superseded_at!: Date | null;

  @Column({ type: 'boolean', default: false })
  is_current!: boolean;

  @Column({ type: 'varchar', length: 100, nullable: true })
  regulatory_reference!: string | null;

  @Column({ type: 'date', nullable: true })
  effective_transaction_date!: string | null;

  @Column({ type: 'uuid', nullable: true })
  created_by!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @ManyToOne(() => Policy, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'policy_id' })
  policy!: Policy;

  @ManyToOne(() => TiramisSubmissionTrackingEntity, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'tiramis_tracking_id' })
  tiramis_tracking!: TiramisSubmissionTrackingEntity | null;

  @ManyToOne(() => PolicyTransaction, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'policy_transaction_id' })
  policy_transaction!: PolicyTransaction | null;

  @ManyToOne(() => PolicyVersion, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'supersedes_version_id' })
  supersedes_version!: PolicyVersion | null;
}
