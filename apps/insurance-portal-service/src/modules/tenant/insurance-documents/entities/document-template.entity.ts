import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { DocumentTemplateVersion } from './document-template-version.entity';

@Entity('document_templates')
export class DocumentTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  company_id: string | null;

  @Column({ type: 'varchar', length: 100 })
  template_code: string;

  @Column({ type: 'varchar', length: 200 })
  template_name: string;

  @Column({ type: 'varchar', length: 80 })
  document_type: string;

  @Column({ type: 'varchar', length: 30 })
  engine: string;

  @Column({ type: 'varchar', length: 30 })
  scope: string;

  @Column({ type: 'varchar', length: 30, default: 'DRAFT' })
  status: string;

  @Column({ type: 'uuid', nullable: true })
  active_version_id: string | null;

  @Column({ type: 'uuid' })
  created_by: string;

  @OneToMany(() => DocumentTemplateVersion, (version) => version.template)
  versions?: DocumentTemplateVersion[];

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
