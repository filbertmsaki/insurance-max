import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Company } from '../../../platform/companies/entities/company.entity';
import { User } from '../../users/entities/user.entity';
import { BranchUser } from './branch-user.entity';
import { BranchFeature } from './branch-feature.entity';

export interface BranchAddress {
  street?: string;
  city?: string;
  region?: string;
  country?: string;
  postal_code?: string;
}

@Entity('branches')
@Unique('UQ_branches_company_code', ['company_id', 'code'])
@Index('IDX_branches_company_id', ['company_id'])
@Index('IDX_branches_status', ['status'])
@Index(
  'uq_branches_policy_numbering_code',
  ['company_id', 'policy_numbering_code'],
  { unique: true },
)
export class Branch {
  @Column({ type: 'varchar', length: 12 })
  policy_numbering_code: string;

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  company_id: string;

  @Column({ length: 120 })
  name: string;

  @Column({ length: 50 })
  code: string;

  /**
   * @deprecated Sales points are stored in tiramis_sale_points.
   */
  @Column({ type: 'varchar', length: 100, nullable: true, select: false })
  sale_point_code: string | null;

  /**
   * @deprecated Sales points are stored in tiramis_sale_points.
   */
  @Column({ type: 'varchar', length: 150, nullable: true, select: false })
  sale_point_name: string | null;

  @Column({ default: false })
  is_head_office: boolean;

  @Column({ default: 'active', length: 20 })
  status: string;

  @Column({ type: 'simple-json', nullable: true })
  address: BranchAddress | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', nullable: true })
  manager_id: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @DeleteDateColumn({ type: 'timestamp', nullable: true })
  deleted_at: Date | null;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'manager_id' })
  manager: User | null;

  @OneToMany(() => BranchUser, (bu) => bu.branch, { cascade: true })
  branch_users: BranchUser[];

  @OneToMany(() => BranchFeature, (bf) => bf.branch, { cascade: true })
  branch_features: BranchFeature[];
}
