import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import {
  DocumentStatus,
  type DocumentStatus as DocumentStatusValue,
} from '@insurance-max/contracts';

import { Document } from './document.entity';

@Entity('document_versions')
@Index('IDX_document_versions_document', ['document_id', 'version_number'], {
  unique: true,
})
export class DocumentVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid' })
  document_id: string;

  @ManyToOne(() => Document, (document) => document.versions, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'document_id' })
  document?: Document;

  @Column({ type: 'int' })
  version_number: number;

  @Column({ type: 'varchar', length: 30 })
  status: DocumentStatusValue;

  @Column({ type: 'varchar', length: 40 })
  storage_provider: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  storage_bucket: string | null;

  @Column({ type: 'varchar', length: 500 })
  storage_key: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  original_file_name: string | null;

  @Column({ type: 'varchar', length: 255 })
  safe_file_name: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  declared_mime_type: string | null;

  @Column({ type: 'varchar', length: 100 })
  detected_mime_type: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  detected_extension: string | null;

  @Column({ type: 'bigint' })
  file_size: number;

  @Column({ type: 'varchar', length: 64 })
  sha256_hash: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  encryption_key_reference: string | null;

  @Column({ type: 'jsonb', nullable: true })
  source_snapshot: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  source_snapshot_hash: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  template_code: string | null;

  @Column({ type: 'int', nullable: true })
  template_version: number | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  generator_version: string | null;

  @Column({ type: 'int', nullable: true })
  page_count: number | null;

  @Column({ type: 'varchar', length: 30, default: 'PENDING' })
  scan_status: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  scan_provider: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  scan_reference: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  scanned_at: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  scan_result: Record<string, unknown> | null;

  @Column({ type: 'uuid', nullable: true })
  uploaded_by: string | null;

  @Column({ type: 'timestamptz' })
  uploaded_at: Date;

  @Column({ type: 'uuid', nullable: true })
  supersedes_version_id: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
