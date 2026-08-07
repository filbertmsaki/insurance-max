import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('notification_preferences')
export class NotificationPreference {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'varchar', length: 120 })
  event_code: string;

  @Column({ type: 'varchar', length: 20 })
  channel: string;

  @Column({ type: 'varchar', length: 20, default: 'INHERIT' })
  mode: string;

  @Column({ type: 'varchar', length: 5, nullable: true })
  quiet_hours_from: string | null;

  @Column({ type: 'varchar', length: 5, nullable: true })
  quiet_hours_to: string | null;

  @Column({ type: 'boolean', default: false })
  marketing_consent: boolean;

  @Column({ type: 'boolean', default: false })
  transactional_required: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
