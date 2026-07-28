import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Role } from '../../../platform/roles/entities/role.entity';
import { Permission } from '../../../platform/permissions/entities/permission.entity';

export enum UserType {
  SUPER_ADMIN = 'SUPER_ADMIN',
  COMPANY_ADMIN = 'COMPANY_ADMIN',
  STAFF = 'STAFF',
  AGENT = 'AGENT',
  BROKER = 'BROKER',
  CUSTOMER = 'CUSTOMER',
  OWNER = 'OWNER',
  COMPANY_USER = 'COMPANY_USER',
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  LOCKED = 'locked',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 30, unique: true })
  user_no: string;

  @Column({ length: 50 })
  first_name: string;

  @Column({ length: 50 })
  last_name: string;

  @Column({ unique: true, length: 20 })
  phone: string;

  @Column({ unique: true, length: 100 })
  email: string;

  @Column({ type: 'varchar', length: 255, select: false, nullable: true })
  password: string | null;

  @Column({ type: 'varchar', length: 20, default: UserStatus.ACTIVE })
  status: string;

  @Column({ type: 'varchar', length: 20, default: UserType.CUSTOMER })
  user_type: string;

  @Column({ type: 'varchar', length: 120, default: 'Underwriter' })
  officer_title: string;

  @Column({ default: false })
  is_email_verified: boolean;

  @Column({ default: false })
  is_phone_verified: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email_verification_token: string | null;

  @Column({ type: 'timestamp', nullable: true })
  email_verification_expires: Date | null;

  @Column({ type: 'int', default: 0 })
  failed_login_attempts: number;

  @Column({ type: 'timestamp', nullable: true })
  locked_until: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  last_login_at: Date | null;

  @Column({ type: 'varchar', length: 45, nullable: true })
  last_login_ip: string | null;

  @Column({ default: false })
  is_two_factor_enabled: boolean;

  @Column({ type: 'text', nullable: true, select: false })
  two_factor_secret: string | null;

  @Column({ type: 'simple-json', nullable: true, select: false })
  two_factor_backup_codes: string[] | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @DeleteDateColumn({ type: 'timestamp', nullable: true })
  deleted_at: Date | null;

  // ── Relations ───────────────────────────────────────────────────────────────

  @ManyToMany(() => Role, (role) => role.users)
  @JoinTable({
    name: 'role_user',
    joinColumn: { name: 'users_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'roles_id', referencedColumnName: 'id' },
  })
  roles: Role[];

  @ManyToMany(() => Permission, (permission) => permission.users)
  @JoinTable({
    name: 'permission_user',
    joinColumn: { name: 'users_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'permissions_id', referencedColumnName: 'id' },
  })
  permissions: Permission[];
}
