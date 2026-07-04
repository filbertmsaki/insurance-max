import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Company } from '../../../platform/companies/entities/company.entity';
import { Policy } from '../../policies/entities/policy.entity';
import { Quotation } from '../../quotations/entities/quotation.entity';
import { PortalTiraSubmissionStatus } from '../enums/portal-tira-submission-status.enum';
import { PortalTiraSubmissionEvent } from './portal-tira-submission-event.entity';

@Entity('portal_tira_submissions')
@Index('IDX_pts_company_id', ['company_id'])
@Index('IDX_pts_policy_id', ['policy_id'])
@Index('IDX_pts_quotation_id', ['quotation_id'])
@Index('IDX_pts_status', ['status'])
@Index('IDX_pts_request_id', ['tiramis_request_id'])
@Index('IDX_pts_transaction_id', ['tiramis_transaction_id'])
@Index('IDX_pts_business_reference', ['business_reference'])
export class PortalTiraSubmission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid', nullable: true })
  policy_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  quotation_id: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  source_module: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  source_record_id: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  business_reference: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  request_type: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  service_type: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  root_element: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  tiramis_transaction_id: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  tiramis_request_id: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  tiramis_response_id: string | null;

  @Column({
    type: 'enum',
    enum: PortalTiraSubmissionStatus,
    enumName: 'portal_tira_submission_status_enum',
    default: PortalTiraSubmissionStatus.DRAFT,
  })
  status: PortalTiraSubmissionStatus;

  @Column({ type: 'varchar', length: 50, nullable: true })
  status_code: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  status_description: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  cover_note_reference_number: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  policy_reference_number: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  sticker_number: string | null;

  @Column({ type: 'text', nullable: true })
  last_error: string | null;

  @Column({ type: 'jsonb', nullable: true })
  last_payload: Record<string, unknown> | null;

  @Column({ type: 'timestamptz', nullable: true })
  submitted_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  last_event_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  completed_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @ManyToOne(() => Policy, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'policy_id' })
  policy: Policy | null;

  @ManyToOne(() => Quotation, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'quotation_id' })
  quotation: Quotation | null;

  @OneToMany(() => PortalTiraSubmissionEvent, (event) => event.submission)
  events: PortalTiraSubmissionEvent[];
}
