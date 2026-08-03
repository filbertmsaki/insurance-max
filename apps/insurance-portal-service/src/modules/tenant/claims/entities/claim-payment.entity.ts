import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { ClaimPaymentStatus } from '../enums/claim.enums';
import { InsuranceClaim } from './claim.entity';
import { TiramisTrackableClaimEntity } from './tiramis-trackable-claim.entity';

@Entity('claim_payments')
export class ClaimPayment extends TiramisTrackableClaimEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid', nullable: true })
  branch_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  sale_point_id: string | null;

  @Column({ type: 'uuid' })
  claim_id: string;

  @Column({ type: 'uuid', nullable: true })
  claimant_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  discharge_voucher_id: string | null;

  @Column({ type: 'varchar', length: 80 })
  claim_payment_number: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  claim_reference_number: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  claim_intimation_number: string | null;

  @Column({ type: 'varchar', length: 100 })
  cover_note_reference_number: string;

  @Column({ type: 'timestamptz', nullable: true })
  payment_date: Date | null;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  paid_amount: string;

  @Column({ type: 'int', default: 1 })
  payment_mode: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  payment_method: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  payment_reference: string | null;

  @Column({ type: 'varchar', length: 1, default: 'N' })
  parties_notified: 'Y' | 'N';

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  net_premium_earned: string;

  @Column({ type: 'varchar', length: 1, default: 'N' })
  claim_resulted_litigation: 'Y' | 'N';

  @Column({ type: 'text', nullable: true })
  litigation_reason: string | null;

  @Column({ type: 'varchar', length: 10 })
  currency_code: string;

  @Column({ type: 'numeric', precision: 18, scale: 6, default: 1 })
  exchange_rate: string;

  @Column({ type: 'varchar', length: 30, default: ClaimPaymentStatus.DRAFT })
  status: ClaimPaymentStatus;

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
  paid_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  paid_at: Date | null;

  @Column({ type: 'text', nullable: true })
  rejection_reason: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => InsuranceClaim, (claim) => claim.payments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'claim_id' })
  claim: InsuranceClaim;
}
