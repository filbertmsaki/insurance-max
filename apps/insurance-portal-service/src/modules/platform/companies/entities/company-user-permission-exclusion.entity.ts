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

/**
 * A permission one membership does not get even though one of its roles
 * grants it. Effective permissions are (role permissions − exclusions) plus
 * direct grants.
 */
@Entity('company_user_permission_exclusions')
@Unique('UQ_company_user_permission_exclusions_membership_permission', [
  'company_user_id',
  'permission_id',
])
export class CompanyUserPermissionExclusion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_user_id: string;

  @Column({ type: 'uuid' })
  permission_id: string;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @ManyToOne(
    () => CompanyUser,
    (companyUser) => companyUser.permission_exclusions,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'company_user_id' })
  company_user: CompanyUser;

  @ManyToOne(() => Permission, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'permission_id' })
  permission: Permission;
}
