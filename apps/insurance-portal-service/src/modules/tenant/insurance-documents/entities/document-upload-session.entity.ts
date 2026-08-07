import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Document } from './document.entity';
import { DocumentVersion } from './document-version.entity';

@Entity('document_upload_sessions')
export class DocumentUploadSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'varchar', length: 30 })
  requested_by_type: string;

  @Column({ type: 'uuid' })
  requested_by_id: string;

  @Column({ type: 'varchar', length: 50 })
  resource_type: string;

  @Column({ type: 'uuid' })
  resource_id: string;

  @Column({ type: 'varchar', length: 80 })
  document_type: string;

  @Column({ type: 'varchar', length: 30 })
  classification: string;

  @Column({ type: 'bigint' })
  maximum_bytes: number;

  @Column({ type: 'jsonb' })
  allowed_mime_types: string[];

  @Column({ type: 'boolean', default: false })
  customer_visible: boolean;

  @Column({ type: 'boolean', default: false })
  intermediary_visible: boolean;

  @Column({ type: 'varchar', length: 40, nullable: true })
  link_type: string | null;

  @Column({ type: 'varchar', length: 180, nullable: true })
  link_label: string | null;

  @Column({ type: 'varchar', length: 30, default: 'PENDING' })
  status: string;

  @Column({ type: 'varchar', length: 64 })
  upload_token_hash: string;

  @Column({ type: 'timestamptz' })
  expires_at: Date;

  @Column({ type: 'uuid', nullable: true })
  document_id: string | null;

  @ManyToOne(() => Document, (document) => document.upload_sessions, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'document_id' })
  document?: Document | null;

  @Column({ type: 'uuid', nullable: true })
  document_version_id: string | null;

  @ManyToOne(() => DocumentVersion, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'document_version_id' })
  document_version?: DocumentVersion | null;

  @Column({ type: 'timestamptz', nullable: true })
  completed_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
