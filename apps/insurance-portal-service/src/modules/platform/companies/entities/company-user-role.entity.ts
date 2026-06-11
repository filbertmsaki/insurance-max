import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Role } from '../../roles/entities/role.entity';
import { CompanyUser } from './company-user.entity';

@Entity('company_user_roles')
@Unique('UQ_company_user_roles_membership_role', ['company_user_id', 'role_id'])
export class CompanyUserRole {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  company_user_id: string;

  @Column({ type: 'varchar' })
  role_id: string;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @ManyToOne(() => CompanyUser, (companyUser) => companyUser.role_assignments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'company_user_id' })
  company_user: CompanyUser;

  @ManyToOne(() => Role, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id' })
  role: Role;
}
