import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Permission } from '../../permissions/entities/permission.entity';
import { CompanyUser } from './company-user.entity';
import { QuotationPolicyDataScope } from '../../../shared/authorization/quotation-policy-data-scope.enum';

@Entity('company_user_permissions')
@Unique('UQ_company_user_permissions_membership_permission', [
  'company_user_id',
  'permission_id',
])
export class CompanyUserPermission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  company_user_id: string;

  @Column({ type: 'varchar' })
  permission_id: string;

  /**
   * Data scope for this direct permission grant. `null` preserves legacy
   * membership-wide behavior until the caller opts into scoped grants.
   */
  @Column({ type: 'varchar', length: 20, nullable: true })
  data_scope: QuotationPolicyDataScope | null;

  @Column({ type: 'uuid', nullable: true })
  scope_branch_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  scope_department_id: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @ManyToOne(
    () => CompanyUser,
    (companyUser) => companyUser.permission_assignments,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'company_user_id' })
  company_user: CompanyUser;

  @ManyToOne(() => Permission, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'permission_id' })
  permission: Permission;
}
