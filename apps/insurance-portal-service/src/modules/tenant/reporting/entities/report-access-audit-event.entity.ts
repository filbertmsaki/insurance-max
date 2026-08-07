import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('report_access_audit_events')
export class ReportAccessAuditEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid', nullable: true })
  user_id!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  report_code!: string | null;

  @Column({ type: 'uuid', nullable: true })
  artifact_id!: string | null;

  @Column({ type: 'varchar', length: 60 })
  access_type: string;

  @Column({ type: 'text', nullable: true })
  purpose!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip_address!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  user_agent!: string | null;

  @Column({ type: 'varchar', length: 30 })
  result: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
