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

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
