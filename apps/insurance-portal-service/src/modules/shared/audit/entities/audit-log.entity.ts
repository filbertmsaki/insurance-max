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

  TWO_FA_LOGIN_SUCCESS = '2fa.login_success',
  TWO_FA_LOGIN_FAILURE = '2fa.login_failure',
  TWO_FA_BACKUP_CODES_REGENERATED = '2fa.backup_codes_regenerated',

  DEVICE_TRUSTED = 'device.trusted',
  DEVICE_UNTRUSTED = 'device.untrusted',
  DEVICE_REMOVED = 'device.removed',

  SESSION_REVOKED = 'session.revoked',
  SESSIONS_REVOKED = 'sessions.revoked',

  REFRESH_TOKEN_REUSE = 'token.refresh_reuse',

  COMPANY_SWITCHED = 'auth.company_switched',

  SERVICE_AUTH_FAILURE = 'service_auth.failure',
}

@Entity('audit_logs')
@Index('IDX_audit_user_id', ['user_id'])
@Index('IDX_audit_action', ['action'])
@Index('IDX_audit_created_at', ['created_at'])
@Index('IDX_audit_company_created', ['company_id', 'created_at'])
@Index('IDX_audit_request_id', ['request_id'])
@Index('IDX_audit_correlation_id', ['correlation_id'])
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

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 20, default: 'success' })
  status: string;

  @Column({ type: 'varchar', nullable: true })
  company_membership_id: string | null;

  @Column({ type: 'varchar', nullable: true })
  branch_id: string | null;

  @Column({ type: 'varchar', nullable: true })
  session_id: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  request_id: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  correlation_id: string | null;

  @Column({ type: 'varchar', length: 30, default: 'user' })
  actor_type: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  actor_service: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  event_category: string | null;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ type: 'jsonb', nullable: true })
  before_state: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  after_state: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  changed_fields: string[] | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
