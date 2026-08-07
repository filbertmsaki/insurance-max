import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { ReportFormat } from '../enums/reporting.enums';

@Entity('report_artifacts')
export class ReportArtifact {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid' })
  job_id: string;

  @Column({ type: 'uuid' })
  definition_id: string;

  @Column({ type: 'enum', enum: ReportFormat })
  format: ReportFormat;

  @Column({ length: 180 })
  file_name: string;

  @Column({ length: 120 })
  mime_type: string;

  @Column({ type: 'text', nullable: true })
  content!: string | null;

  @Column({ type: 'bigint', default: 0 })
  size_bytes: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  checksum!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  expires_at!: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  report_code!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  storage_key!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  file_hash!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  retention_until!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  deleted_at!: Date | null;

  @Column({ type: 'bigint', default: 0 })
  download_count!: string;

  @Column({ type: 'timestamptz', nullable: true })
  last_downloaded_at!: Date | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  tenant_scope_hash!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
