import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('signature_requests')
export class SignatureRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'varchar', length: 100 })
  request_no: string;

  @Column({ type: 'uuid' })
  document_id: string;

  @Column({ type: 'uuid' })
  document_version_id: string;

  @Column({ type: 'varchar', length: 30, default: 'DRAFT' })
  status: string;

  @Column({ type: 'varchar', length: 50 })
  signature_provider: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  provider_request_id: string | null;

  @Column({ type: 'boolean', default: false })
  signing_order_required: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  expires_at: Date | null;

  @Column({ type: 'uuid', nullable: true })
  completion_document_version_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  evidence_document_id: string | null;

  @Column({ type: 'uuid' })
  created_by: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  completed_at: Date | null;
}
