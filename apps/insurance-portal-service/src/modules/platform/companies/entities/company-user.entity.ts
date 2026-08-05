import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { ApiHideProperty } from '@nestjs/swagger';
import { User } from '../../../tenant/users/entities/user.entity';
import { Company } from './company.entity';
import { CompanyUserRole } from './company-user-role.entity';
import { CompanyUserPermission } from './company-user-permission.entity';

@Entity('company_users')
@Unique('UQ_company_users_company_user', ['company_id', 'user_id'])
export class CompanyUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  company_id: string;

  @Column({ type: 'varchar' })
  user_id: string;

  @Column({ default: 'active', length: 20 })
  status: string;

  @Column({ default: false })
  is_default: boolean;

  @Column({ type: 'timestamp', nullable: true })
  last_accessed_at: Date | null;

  @Column({ type: 'integer', default: 1 })
  authorization_version: number;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @ManyToOne(() => Company, (company) => company.memberships, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @ApiHideProperty()
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(() => CompanyUserRole, (assignment) => assignment.company_user, {
    cascade: true,
  })
  role_assignments: CompanyUserRole[];

  @OneToMany(
    () => CompanyUserPermission,
    (assignment) => assignment.company_user,
    { cascade: true },
  )
  permission_assignments: CompanyUserPermission[];
}
