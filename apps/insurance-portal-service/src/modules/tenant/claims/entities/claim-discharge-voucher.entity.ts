import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { ClaimDischargeStatus } from '../enums/claim.enums';
import { TiramisTrackableClaimEntity } from './tiramis-trackable-claim.entity';

@Entity('claim_discharge_vouchers')
export class ClaimDischargeVoucher extends TiramisTrackableClaimEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid', nullable: true })
  branch_id: string | null;

  @Column({ type: 'uuid' })
  claim_id: string;

  @Column({ type: 'uuid', nullable: true })
  claimant_id: string | null;

  @Column({ type: 'varchar', length: 80 })
  discharge_voucher_number: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  claim_assessment_number: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  claim_reference_number: string | null;

  @Column({ type: 'varchar', length: 100 })
  cover_note_reference_number: string;

  @Column({ type: 'timestamptz' })
  discharge_voucher_date: Date;

  @Column({ type: 'varchar', length: 10 })
  currency_code: string;

  @Column({ type: 'numeric', precision: 18, scale: 6, default: 1 })
  exchange_rate: string;

  @Column({ type: 'timestamptz' })
  claim_offer_communication_date: Date;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  claim_offer_amount: string;

  @Column({ type: 'timestamptz', nullable: true })
  claimant_response_date: Date | null;

  @Column({ type: 'varchar', length: 1, default: 'N' })
  offer_accepted: 'Y' | 'N';

  @Column({ type: 'uuid', nullable: true })
  signed_document_id: string | null;

  @Column({ type: 'varchar', length: 30, default: ClaimDischargeStatus.DRAFT })
  status: ClaimDischargeStatus;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @Column({ type: 'uuid', nullable: true })
  submitted_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  submitted_at: Date | null;

  @Column({ type: 'uuid', nullable: true })
  approved_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  approved_at: Date | null;

  @Column({ type: 'uuid', nullable: true })
  rejected_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  rejected_at: Date | null;

  @Column({ type: 'text', nullable: true })
  rejection_reason: string | null;

  @Column({ type: 'uuid', nullable: true })
  assessment_id: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  adjustment_date: Date | null;

  @Column({ type: 'text', nullable: true })
  adjustment_reason: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 2, nullable: true })
  adjustment_amount: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  reconciliation_date: Date | null;

  @Column({ type: 'text', nullable: true })
  reconciliation_summary: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 2, nullable: true })
  reconciled_amount: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  claimants: Record<string, unknown>[];

  @Column({ type: 'int', default: 1 })
  version: number;

  @Column({ type: 'uuid', nullable: true })
  supersedes_voucher_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  generated_document_id: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
