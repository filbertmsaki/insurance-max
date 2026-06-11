import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum OtpChannel {
  SMS = 'sms',
  EMAIL = 'email',
}

export enum OtpPurpose {
  LOGIN = 'login',
  REGISTRATION = 'registration',
  PHONE_VERIFY = 'phone_verify',
  PASSWORD_RESET = 'password_reset',
  TRANSACTION = 'transaction',
}

@Entity('otp_verifications')
@Index('IDX_otp_target_purpose', ['target', 'purpose'])
@Index('IDX_otp_user_id', ['user_id'])
export class OtpVerification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: true })
  user_id: string | null;

  @Column({ length: 100 })
  target: string;

  @Column({ type: 'varchar', length: 10 })
  channel: string;

  @Column({ type: 'varchar', length: 30 })
  purpose: string;

  @Column({ length: 255 })
  otp_hash: string;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ default: false })
  is_verified: boolean;

  @Column({ type: 'timestamp' })
  expires_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  verified_at: Date | null;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ip_address: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;
}
