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
import { InsuranceCategory } from '../../insurance-categories/entities/insurance-category.entity';

@Entity('department_category_access')
@Unique('UQ_dept_category_access_company_dept_category', [
  'company_id',
  'department_id',
  'category_id',
])
@Index('IDX_dept_category_access_company_id', ['company_id'])
@Index('IDX_dept_category_access_department_id', ['department_id'])
@Index('IDX_dept_category_access_category_id', ['category_id'])
export class DepartmentCategoryAccess {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  company_id: string;

  @Column({ type: 'varchar' })
  department_id: string;

  @Column({ type: 'varchar' })
  category_id: string;

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

  @ManyToOne(() => InsuranceCategory, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'category_id' })
  category: InsuranceCategory;
}
