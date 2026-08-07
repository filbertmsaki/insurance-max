import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Document } from './document.entity';
import { DocumentVersion } from './document-version.entity';

@Entity('document_access_events')
export class DocumentAccessEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid' })
  document_id: string;

  @ManyToOne(() => Document, (document) => document.access_events, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'document_id' })
  document?: Document;

  @Column({ type: 'uuid', nullable: true })
  document_version_id: string | null;

  @ManyToOne(() => DocumentVersion, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'document_version_id' })
  document_version?: DocumentVersion | null;

  @Column({ type: 'varchar', length: 30 })
  actor_type: string;

  @Column({ type: 'uuid', nullable: true })
  actor_id: string | null;

  @Column({ type: 'varchar', length: 30 })
  action: string;

  @Column({ type: 'varchar', length: 30 })
  access_channel: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  purpose: string | null;

  @Column({ type: 'inet', nullable: true })
  ip_address: string | null;

  @Column({ type: 'text', nullable: true })
  user_agent: string | null;

  @Column({ type: 'varchar', length: 30 })
  result: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  failure_reason: string | null;

  @Column({ type: 'timestamptz' })
  occurred_at: Date;
}
