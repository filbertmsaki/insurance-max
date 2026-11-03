import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  RelationId,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Company } from '../../../platform/companies/entities/company.entity';
import { Branch } from '../../branches/entities/branch.entity';
import { DepartmentUser } from './department-user.entity';

@Entity('departments')
@Unique('UQ_departments_company_code', ['company_id', 'code'])
@Unique('UQ_departments_company_name', ['company_id', 'name'])
@Index('IDX_departments_company_id', ['company_id'])
@Index('IDX_departments_status', ['status'])
export class Department {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  company_id: string;

  @Column({ length: 120 })
  name: string;

  @Column({ length: 50 })
  code: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ default: 'active', length: 20 })
  status: string;

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

  /** Branches this department operates in; empty means company-wide. */
  @ManyToMany(() => Branch)
  @JoinTable({
    name: 'department_branches',
    joinColumn: { name: 'department_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'branch_id', referencedColumnName: 'id' },
  })
  branches: Branch[];

  @RelationId((department: Department) => department.branches)
  branch_ids: string[];

  @OneToMany(() => DepartmentUser, (assignment) => assignment.department)
  department_users: DepartmentUser[];
}

/** True when the department is company-wide or operates in the given branch. */
export function departmentServesBranch(
  department: Pick<Department, 'branch_ids'>,
  branchId: string | null | undefined,
): boolean {
  const branchIds = department.branch_ids ?? [];
  return branchIds.length === 0 || (!!branchId && branchIds.includes(branchId));
}
