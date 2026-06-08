import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Company } from '../../companies/entities/company.entity';
import { BranchFeature } from './branch-feature.entity';

@Entity('company_features')
@Unique('UQ_company_features_company_key', ['company_id', 'feature_key'])
@Index('IDX_company_features_company_id', ['company_id'])
export class CompanyFeature {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  company_id: string;

  @Column({ length: 100, name: 'feature_key' })
  feature_key: string;

  @Column({ length: 150, name: 'display_name' })
  display_name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ default: true, name: 'is_enabled' })
  is_enabled: boolean;

  @Column({ type: 'simple-json', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @OneToMany(() => BranchFeature, (bf) => bf.company_feature, { cascade: true })
  branch_features: BranchFeature[];
}
