import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { AccessStatus } from '@insurance-max/portal-shared/enums/access-status.enum';
import { Company } from '../../companies/entities/company.entity';
import { Branch } from '../../branches/entities/branch.entity';
import { InsuranceProduct } from '../../insurance-products/entities/insurance-product.entity';

@Entity('branch_product_access')
@Unique('UQ_branch_product_access_company_branch_product', [
  'company_id',
  'branch_id',
  'product_id',
])
@Index('IDX_branch_product_access_company_id', ['company_id'])
@Index('IDX_branch_product_access_branch_id', ['branch_id'])
@Index('IDX_branch_product_access_product_id', ['product_id'])
export class BranchProductAccess {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  company_id: string;

  @Column({ type: 'varchar' })
  branch_id: string;

  @Column({ type: 'varchar' })
  product_id: string;

  @Column({ default: true })
  can_view: boolean;

  @Column({ default: false })
  can_create_policy: boolean;

  @Column({ type: 'varchar', enum: AccessStatus, default: AccessStatus.ALLOW })
  access_status: AccessStatus;

  @Column({ default: true })
  is_active: boolean;

  @Column({ type: 'varchar', nullable: true })
  created_by: string | null;

  @Column({ type: 'varchar', nullable: true })
  updated_by: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @DeleteDateColumn({ type: 'timestamp', nullable: true })
  deleted_at: Date | null;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @ManyToOne(() => Branch, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;

  @ManyToOne(() => InsuranceProduct, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: InsuranceProduct;
}
