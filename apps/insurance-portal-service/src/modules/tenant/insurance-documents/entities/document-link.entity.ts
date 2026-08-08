import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import {
  DocumentLinkType,
  type DocumentLinkType as DocumentLinkTypeValue,
} from '@insurance-max/contracts';

import { Document } from './document.entity';

@Entity('document_links')
export class DocumentLink {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid' })
  document_id: string;

  @ManyToOne(() => Document, (document) => document.links, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'document_id' })
  document?: Document;

  @Column({ type: 'varchar', length: 40 })
  link_type: DocumentLinkTypeValue;

  @Column({ type: 'varchar', length: 60 })
  linked_record_type: string;

  @Column({ type: 'uuid' })
  linked_record_id: string;

  @Column({ type: 'boolean', default: false })
  customer_visible: boolean;

  @Column({ type: 'boolean', default: false })
  intermediary_visible: boolean;

  @Column({ type: 'varchar', length: 180, nullable: true })
  label: string | null;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}

export { DocumentLinkType, type DocumentLinkTypeValue as DocumentLinkTypeType };
