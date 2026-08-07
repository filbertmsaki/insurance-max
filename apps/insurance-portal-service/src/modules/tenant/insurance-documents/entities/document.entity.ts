import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  DocumentClassification,
  type DocumentClassification as DocumentClassificationValue,
  DocumentSourceType,
  type DocumentSourceType as DocumentSourceTypeValue,
  DocumentStatus,
  type DocumentStatus as DocumentStatusValue,
} from '@insurance-max/contracts';

import { DocumentAccessEvent } from './document-access-event.entity';
import { DocumentLink } from './document-link.entity';
import { DocumentUploadSession } from './document-upload-session.entity';
import { DocumentVersion } from './document-version.entity';

@Entity('documents')
@Index('IDX_documents_owner', ['company_id', 'owner_type', 'owner_id'])
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  document_no: string | null;

  @Column({ type: 'varchar', length: 60 })
  owner_type: string;

  @Column({ type: 'uuid', nullable: true })
  owner_id: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  title: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  document_type: string | null;

  @Column({
    type: 'varchar',
    length: 30,
    default: DocumentClassification.INTERNAL,
  })
  classification: DocumentClassificationValue;

  @Column({ type: 'varchar', length: 30, nullable: true })
  source_type: DocumentSourceTypeValue | null;

  @Column({ type: 'varchar', length: 500 })
  storage_key: string;

  @Column({ type: 'varchar', length: 128 })
  checksum: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  content_type: string | null;

  @Column({ type: 'varchar', length: 255 })
  file_name: string;

  @Column({ type: 'bigint', nullable: true })
  file_size: number | null;

  @Column({
    type: 'varchar',
    length: 30,
    default: DocumentStatus.UPLOAD_PENDING,
  })
  status: DocumentStatusValue;

  @Column({ type: 'uuid', nullable: true })
  current_version_id: string | null;

  @ManyToOne(() => DocumentVersion, { nullable: true })
  @JoinColumn({ name: 'current_version_id' })
  current_version?: DocumentVersion | null;

  @Column({ type: 'boolean', default: false })
  customer_visible: boolean;

  @Column({ type: 'boolean', default: false })
  intermediary_visible: boolean;

  @Column({ type: 'boolean', default: false })
  public_verification_enabled: boolean;

  @Column({ type: 'varchar', length: 120, nullable: true })
  public_verification_code: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  retention_policy_code: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  retention_until: Date | null;

  @Column({ type: 'boolean', default: false })
  legal_hold: boolean;

  @Column({ type: 'text', nullable: true })
  legal_hold_reason: string | null;

  @Column({ type: 'uuid', nullable: true })
  uploaded_by: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  uploaded_at: Date;

  @Column({ type: 'uuid', nullable: true })
  verified_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  verified_at: Date | null;

  @Column({ type: 'text', nullable: true })
  rejection_reason: string | null;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  archived_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

  @OneToMany(() => DocumentVersion, (version) => version.document)
  versions?: DocumentVersion[];

  @OneToMany(() => DocumentLink, (link) => link.document)
  links?: DocumentLink[];

  @OneToMany(() => DocumentUploadSession, (session) => session.document)
  upload_sessions?: DocumentUploadSession[];

  @OneToMany(() => DocumentAccessEvent, (event) => event.document)
  access_events?: DocumentAccessEvent[];

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}

export {
  DocumentClassification,
  DocumentSourceType,
  DocumentStatus,
  type DocumentClassificationValue as DocumentClassificationType,
  type DocumentSourceTypeValue as DocumentSourceTypeType,
  type DocumentStatusValue as DocumentStatusType,
};
