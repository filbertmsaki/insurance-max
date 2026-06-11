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
import { User } from '../../../tenant/users/entities/user.entity';

@Entity('devices')
@Unique('UQ_devices_user_fingerprint', ['user_id', 'fingerprint'])
@Index('IDX_devices_user_id', ['user_id'])
export class Device {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  user_id: string;

  @Column({ length: 255 })
  fingerprint: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  device_name: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  device_type: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  os: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  browser: string | null;

  @Column({ default: false })
  trusted: boolean;

  @Column({ type: 'timestamp', nullable: true })
  trusted_at: Date | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  last_used_at: Date;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
