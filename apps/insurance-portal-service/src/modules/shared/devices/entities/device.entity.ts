import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { User } from '../../../tenant/users/entities/user.entity';

@Entity('devices')
@Unique('UQ_devices_user_fingerprint', ['user_id', 'fingerprint'])
@Index('IDX_devices_user_id', ['user_id'])
@Index('IDX_devices_user_trusted', ['user_id', 'trusted', 'trusted_until'])
export class Device {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'uuid',
  })
  user_id: string;

  /**
   * This stores a server-side HMAC of the browser device token.
   * It does not store the raw browser token.
   */
  @Column({
    length: 255,
  })
  fingerprint: string;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  device_name: string | null;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  device_type: string | null;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  os: string | null;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  browser: string | null;

  @Column({
    default: false,
  })
  trusted: boolean;

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  trusted_at: Date | null;

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  trusted_until: Date | null;

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  revoked_at: Date | null;

  @Column({
    type: 'varchar',
    length: 45,
    nullable: true,
  })
  last_ip_address: string | null;

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
