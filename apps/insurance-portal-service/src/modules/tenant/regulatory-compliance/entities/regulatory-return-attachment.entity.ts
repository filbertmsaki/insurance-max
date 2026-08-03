import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('regulatory_return_attachments')
export class RegulatoryReturnAttachment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  return_id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ length: 160 })
  file_name: string;

  @Column({ length: 120, nullable: true })
  evidence_type!: string | null;

  @Column({ length: 255, nullable: true })
  storage_path!: string | null;

  @Column({ length: 120, nullable: true })
  mime_type!: string | null;

  @Column({ type: 'uuid', nullable: true })
  uploaded_by!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  uploaded_at: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;
}
