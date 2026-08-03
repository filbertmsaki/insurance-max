import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('tenant_notifications')
@Index('IDX_tenant_notification_user', [
  'company_id',
  'recipient_user_id',
  'read_at',
])
export class TenantNotification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid', nullable: true })
  branch_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  recipient_user_id: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  recipient_role: string | null;

  @Column({ type: 'varchar', length: 50 })
  type: string;

  @Column({ type: 'varchar', length: 20, default: 'INFO' })
  severity: string;

  @Column({ type: 'varchar', length: 180 })
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  resource_type: string | null;

  @Column({ type: 'uuid', nullable: true })
  resource_id: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  action_url: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ type: 'timestamptz', nullable: true })
  read_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
