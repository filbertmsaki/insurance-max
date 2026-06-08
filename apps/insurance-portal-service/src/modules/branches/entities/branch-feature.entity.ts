import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Branch } from './branch.entity';
import { CompanyFeature } from './company-feature.entity';

@Entity('branch_features')
@Unique('UQ_branch_features_branch_feature', [
  'branch_id',
  'company_feature_id',
])
export class BranchFeature {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  branch_id: string;

  @Column({ type: 'varchar' })
  company_feature_id: string;

  @Column({ default: true })
  is_enabled: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @ManyToOne(() => Branch, (branch) => branch.branch_features, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;

  @ManyToOne(() => CompanyFeature, (cf) => cf.branch_features, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'company_feature_id' })
  company_feature: CompanyFeature;
}
