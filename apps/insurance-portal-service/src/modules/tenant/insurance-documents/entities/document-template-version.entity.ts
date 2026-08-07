import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { DocumentTemplate } from './document-template.entity';

@Entity('document_template_versions')
export class DocumentTemplateVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  template_id: string;

  @ManyToOne(() => DocumentTemplate, (template) => template.versions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'template_id' })
  template?: DocumentTemplate;

  @Column({ type: 'int' })
  version_number: number;

  @Column({ type: 'varchar', length: 30, default: 'DRAFT' })
  status: string;

  @Column({ type: 'text' })
  template_content: string;

  @Column({ type: 'text', nullable: true })
  stylesheet_content: string | null;

  @Column({ type: 'text', nullable: true })
  header_content: string | null;

  @Column({ type: 'text', nullable: true })
  footer_content: string | null;

  @Column({ type: 'jsonb' })
  variable_schema: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  sample_data: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 64 })
  template_hash: string;

  @Column({ type: 'uuid' })
  created_by: string;

  @Column({ type: 'uuid', nullable: true })
  approved_by: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  approved_at: Date | null;
}
