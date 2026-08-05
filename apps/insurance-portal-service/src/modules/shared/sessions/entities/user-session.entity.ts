import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { User } from '../../../tenant/users/entities/user.entity';

@Entity('user_sessions')
@Index('IDX_sessions_user_id', ['user_id'])
@Index('IDX_sessions_expires_revoked', ['expires_at', 'revoked'])
@Index('IDX_user_sessions_user_active', ['user_id', 'revoked', 'expires_at'])
@Index('IDX_user_sessions_device_active', ['device_id', 'revoked'])
export class UserSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  /**
   * Never return this field from normal repository queries.
   */
  @Column({
    length: 255,
    select: false,
  })
  refresh_token_hash: string;

  @Column({
    type: 'uuid',
    nullable: true,
  })
  device_id: string | null;

  @Column({
    type: 'varchar',
    length: 45,
    nullable: true,
  })
  ip_address: string | null;

  @Column({
    type: 'text',
    nullable: true,
  })
  user_agent: string | null;

  @Column({
    type: 'simple-json',
    nullable: true,
  })
  device_info: Record<string, unknown> | null;

  @Column({
    type: 'timestamptz',
  })
  expires_at: Date;

  @Column({
    default: false,
  })
  revoked: boolean;

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  revoked_at: Date | null;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  revocation_reason: string | null;

  @Column({
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  last_used_at: Date;

  @CreateDateColumn({
    type: 'timestamptz',
  })
  created_at: Date;

  @UpdateDateColumn({
    type: 'timestamptz',
  })
  updated_at: Date;

  @ManyToOne(() => User, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'user_id',
  })
  user: User;
}
