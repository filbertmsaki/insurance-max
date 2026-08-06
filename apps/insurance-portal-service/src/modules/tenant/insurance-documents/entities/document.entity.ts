import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export const DocumentStatus = {
  PENDING: 'PENDING',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
} as const;

export type DocumentStatus = (typeof DocumentStatus)[keyof typeof DocumentStatus];

/**
 * Lightweight, cross-domain document registry. Formalizes what individual
 * modules (claims, discharge vouchers, complaints, ...) already store as a
 * bare storage-key string into one referenceable, server-validated record —
 * it is not a file-storage/virus-scan service, just the metadata authority.
 */
@Entity('documents')
@Index('IDX_documents_owner', ['company_id', 'owner_type', 'owner_id'])
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'varchar', length: 60 })
  owner_type: string;

  @Column({ type: 'uuid', nullable: true })
  owner_id: string | null;

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

  @Column({ type: 'varchar', length: 20, default: DocumentStatus.PENDING })
  status: DocumentStatus;

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

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
