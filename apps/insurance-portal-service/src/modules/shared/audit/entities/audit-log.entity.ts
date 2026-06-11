import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum AuditAction {
  LOGIN_SUCCESS = 'login.success',
  LOGIN_FAILURE = 'login.failure',
  LOGOUT = 'logout',
  REGISTER = 'register',
  OTP_SENT = 'otp.sent',
  OTP_VERIFIED = 'otp.verified',
  OTP_FAILED = 'otp.failed',
  PASSWORD_RESET_REQUEST = 'password.reset_request',
  PASSWORD_RESET_SUCCESS = 'password.reset_success',
  PASSWORD_CHANGED = 'password.changed',
  EMAIL_VERIFIED = 'email.verified',
  PHONE_VERIFIED = 'phone.verified',
  ROLE_ASSIGNED = 'role.assigned',
  ROLE_REVOKED = 'role.revoked',
  PERMISSION_GRANTED = 'permission.granted',
  PERMISSION_REVOKED = 'permission.revoked',
  TOKEN_REVOKED = 'token.revoked',
  ACCOUNT_LOCKED = 'account.locked',
  ACCOUNT_UNLOCKED = 'account.unlocked',
  TWO_FA_ENABLED = '2fa.enabled',
  TWO_FA_DISABLED = '2fa.disabled',
  API_KEY_CREATED = 'api_key.created',
  API_KEY_REVOKED = 'api_key.revoked',
  USER_CREATED = 'user.created',
  USER_UPDATED = 'user.updated',
  USER_DELETED = 'user.deleted',
}

@Entity('audit_logs')
@Index('IDX_audit_user_id', ['user_id'])
@Index('IDX_audit_action', ['action'])
@Index('IDX_audit_created_at', ['created_at'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: true })
  user_id: string | null;

  @Column({ type: 'varchar', nullable: true })
  company_id: string | null;

  @Column({ length: 100 })
  action: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  resource: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  resource_id: string | null;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ip_address: string | null;

  @Column({ type: 'text', nullable: true })
  user_agent: string | null;

  @Column({ type: 'simple-json', nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 20, default: 'success' })
  status: string;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;
}
