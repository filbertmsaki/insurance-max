import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Policy } from '../../policies/entities/policy.entity';
import { ReinsuranceDeclarationStatus } from '../enums/reinsurance.enums';
import { PolicyCession } from './policy-cession.entity';

export interface ReinsuranceDeclarationParticipant {
  participantCode: string;
  participantType: number;
  reinsuranceForm: number;
  reinsuranceType: number;
  reBrokerCode: string;
  brokerageCommission: string;
  reinsuranceCommission: string;
  premiumShare: string;
  participationDate: string;
}

@Entity('reinsurance_declarations')
export class ReinsuranceDeclaration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid', nullable: true })
  branch_id: string | null;

  @Column({ type: 'uuid' })
  policy_id: string;

  @Column({ type: 'uuid' })
  cession_id: string;

  @Column({ type: 'varchar', length: 60 })
  declaration_no: string;

  @Column({ type: 'varchar', length: 100 })
  cover_note_reference_number: string;

  @Column({ type: 'numeric', precision: 20, scale: 2 })
  premium_including_tax: string;

  @Column({ type: 'varchar', length: 10 })
  currency_code: string;

  @Column({ type: 'numeric', precision: 18, scale: 6, default: 1 })
  exchange_rate: string;

  @Column({ type: 'varchar', length: 150 })
  authorizing_officer_name: string;

  @Column({ type: 'varchar', length: 100 })
  authorizing_officer_title: string;

  @Column({ type: 'int' })
  reinsurance_category: number;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  participants: ReinsuranceDeclarationParticipant[];

  @Column({
    type: 'varchar',
    length: 30,
    default: ReinsuranceDeclarationStatus.DRAFT,
  })
  status: ReinsuranceDeclarationStatus;

  @Column({ type: 'uuid', nullable: true })
  tiramis_submission_tracking_id: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  tiramis_status: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  tiramis_transaction_id: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  tiramis_request_id: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  tiramis_service_type: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  tiramis_root_element: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  tiramis_acknowledgement_status_code: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  tiramis_acknowledgement_status_desc: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  tiramis_final_response_id: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  tiramis_final_response_status_code: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  tiramis_final_response_status_desc: string | null;

  @Column({ type: 'text', nullable: true })
  tiramis_last_error_message: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  tiramis_last_synced_at: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  tiramis_payload: Record<string, unknown> | null;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  submitted_at: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

  @ManyToOne(() => Policy, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'policy_id' })
  policy: Policy;

  @ManyToOne(() => PolicyCession, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'cession_id' })
  cession: PolicyCession;
}
