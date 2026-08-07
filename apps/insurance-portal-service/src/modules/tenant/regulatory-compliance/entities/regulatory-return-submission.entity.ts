import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('regulatory_return_submissions')
export class RegulatoryReturnSubmission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid' })
  regulatory_return_id: string;

  @Column({ type: 'varchar', length: 100 })
  submission_no: string;

  @Column({ type: 'varchar', length: 50 })
  submission_channel: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  submission_reference!: string | null;

  @Column({ type: 'varchar', length: 40, default: 'SUBMISSION_PROCESSING' })
  status: string;

  @Column({ type: 'varchar', length: 64 })
  submitted_payload_hash: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  acknowledgement_reference!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  acknowledgement_code!: string | null;

  @Column({ type: 'text', nullable: true })
  acknowledgement_message!: string | null;

  @Column({ type: 'uuid' })
  submitted_by: string;

  @Column({ type: 'timestamptz' })
  submitted_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  acknowledged_at!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  rejected_at!: Date | null;

  @Column({ type: 'uuid', nullable: true })
  evidence_document_id!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
