import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Permission } from '../../permissions/entities/permission.entity';
import { Role } from './role.entity';
import { QuotationPolicyDataScope } from '../../../shared/authorization/quotation-policy-data-scope.enum';

@Entity('role_permission_scopes')
@Unique('UQ_role_permission_scopes_role_permission', [
  'role_id',
  'permission_id',
])
@Index('IDX_role_permission_scopes_permission_scope', [
  'permission_id',
  'data_scope',
])
export class RolePermissionScope {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  role_id: string;

  @Column({ type: 'uuid' })
  permission_id: string;

  @Column({ type: 'varchar', length: 20 })
  data_scope: QuotationPolicyDataScope;

  @Column({ type: 'uuid', nullable: true })
  scope_branch_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  scope_department_id: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @ManyToOne(() => Role, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id' })
  role: Role;

  @ManyToOne(() => Permission, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'permission_id' })
  permission: Permission;
}
