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
import { Department } from '../../departments/entities/department.entity';
import { InsuranceProduct } from '../../insurance-products/entities/insurance-product.entity';

@Entity('department_product_access')
@Unique('UQ_dept_product_access_company_dept_product', [
  'company_id',
  'department_id',
  'product_id',
])
@Index('IDX_dept_product_access_company_id', ['company_id'])
@Index('IDX_dept_product_access_department_id', ['department_id'])
@Index('IDX_dept_product_access_product_id', ['product_id'])
export class DepartmentProductAccess {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  company_id: string;

  @Column({ type: 'varchar' })
  department_id: string;

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

  @ManyToOne(() => Department, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'department_id' })
  department: Department;

  @ManyToOne(() => InsuranceProduct, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: InsuranceProduct;
}
