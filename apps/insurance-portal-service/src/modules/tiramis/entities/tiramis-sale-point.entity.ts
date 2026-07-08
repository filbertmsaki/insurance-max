import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { Company } from '../../platform/companies/entities/company.entity';
import { Branch } from '../../tenant/branches/entities/branch.entity';

@Entity({ name: 'tiramis_sale_points' })
@Unique('UQ_tiramis_sale_points_company_sale_point', [
  'companyId',
  'salePointCode',
])
@Index('IDX_tiramis_sale_points_company_id', ['companyId'])
@Index('IDX_tiramis_sale_points_branch_id', ['branchId'])
@Index('IDX_tiramis_sale_points_sale_point_code', ['salePointCode'])
export class TiramisSalePointEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'company_id', type: 'uuid' })
  companyId!: string;

  @Column({ name: 'branch_id', type: 'uuid', nullable: true })
  branchId!: string | null;

  @Column({
    name: 'branch_code',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  branchCode!: string | null;

  @Column({
    name: 'branch_name',
    type: 'varchar',
    length: 120,
    nullable: true,
  })
  branchName!: string | null;

  @Column({ name: 'sale_point_code', type: 'varchar', length: 50 })
  salePointCode!: string;

  @Column({
    name: 'sale_point_name',
    type: 'varchar',
    length: 120,
    nullable: true,
  })
  salePointName!: string | null;

  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault!: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'metadata', type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company!: Company;

  @ManyToOne(() => Branch, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'branch_id' })
  branch!: Branch | null;
}
