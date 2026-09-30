import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { TiramisTrackableClaimEntity } from './tiramis-trackable-claim.entity';

@Entity('claim_rejections')
export class ClaimRejection extends TiramisTrackableClaimEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid', nullable: true })
  branch_id: string | null;

  @Column({ type: 'uuid' })
  claim_id: string;

  @Column({ type: 'varchar', length: 80 })
  claim_rejection_number: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  claim_reference_number: string | null;

  @Column({ type: 'varchar', length: 100 })
  cover_note_reference_number: string;

  @Column({ type: 'timestamptz' })
  rejection_date: Date;

  @Column({ type: 'text' })
  rejection_reason: string;

  @Column({ type: 'varchar', length: 30, default: 'APPROVED' })
  status: string;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @Column({ type: 'uuid', nullable: true })
  approved_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  approved_at: Date | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  claim_intimation_number: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  tira_rejection_reason: string | null;

  @Column({ type: 'varchar', length: 1, default: 'N' })
  claim_resulted_litigation: 'Y' | 'N';

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  claim_amount: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  currency_code: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 6, default: 1 })
  exchange_rate: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  claimants: Record<string, unknown>[];

  @Column({ type: 'text', nullable: true })
  recommendation: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  policy_clause_reference: string | null;

  @Column({ type: 'uuid', nullable: true })
  letter_document_id: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  previous_claim_status: string | null;

  @Column({ type: 'uuid', nullable: true })
  submitted_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  submitted_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
