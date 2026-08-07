import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { DocumentVersion } from './document-version.entity';

@Entity('document_security_scans')
export class DocumentSecurityScan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid' })
  document_version_id: string;

  @ManyToOne(() => DocumentVersion, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'document_version_id' })
  document_version?: DocumentVersion;

  @Column({ type: 'varchar', length: 40 })
  scan_type: string;

  @Column({ type: 'varchar', length: 50 })
  provider: string;

  @Column({ type: 'varchar', length: 30 })
  status: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  result_code: string | null;

  @Column({ type: 'text', nullable: true })
  result_message: string | null;

  @Column({ type: 'jsonb', nullable: true })
  details: Record<string, unknown> | null;

  @Column({ type: 'timestamptz' })
  started_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  completed_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
