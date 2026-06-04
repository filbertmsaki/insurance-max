import { BaseEntity } from '@insurance-max/persistence';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';

import { TiramisSubmissionAttemptEntity } from '../../submissions/entities/tiramis-submission-attempt.entity';
import { TiramisTransactionEntity } from '../../submissions/entities/tiramis-transaction.entity';
import { TiramisClaimantEntity } from './tiramis-claimant.entity';

@Entity({ name: 'tiramis_discharge_vouchers' })
@Index(['requestId'])
@Index(['dischargeVoucherNumber'])
@Index(['claimReferenceNumber'])
export class TiramisDischargeVoucherEntity extends BaseEntity {
  @Column({ name: 'transaction_id' })
  transactionId!: string;

  @ManyToOne(() => TiramisTransactionEntity)
  @JoinColumn({ name: 'transaction_id' })
  transaction!: TiramisTransactionEntity;

  @Column({ name: 'current_attempt_id', nullable: true })
  currentAttemptId?: string | null;

  @ManyToOne(() => TiramisSubmissionAttemptEntity, { nullable: true })
  @JoinColumn({ name: 'current_attempt_id' })
  currentAttempt?: TiramisSubmissionAttemptEntity | null;

  @Column({ name: 'request_id', length: 50 })
  requestId!: string;

  @Column({ name: 'company_code', length: 6 })
  companyCode!: string;

  @Column({ name: 'system_code', length: 12 })
  systemCode!: string;

  @Column({ name: 'callback_url', length: 250 })
  callbackUrl!: string;

  @Column({ name: 'insurer_company_code', length: 6 })
  insurerCompanyCode!: string;

  @Column({ name: 'discharge_voucher_number', length: 50 })
  dischargeVoucherNumber!: string;

  @Column({ name: 'claim_assessment_number', length: 50 })
  claimAssessmentNumber!: string;

  @Column({ name: 'claim_reference_number', length: 50 })
  claimReferenceNumber!: string;

  @Column({ name: 'cover_note_reference_number', length: 50 })
  coverNoteReferenceNumber!: string;

  @Column({ name: 'discharge_voucher_date' })
  dischargeVoucherDate!: Date;

  @Column({ name: 'currency_code', length: 3 })
  currencyCode!: string;

  @Column({ name: 'exchange_rate', type: 'decimal', precision: 36, scale: 2 })
  exchangeRate!: string;

  @Column({ name: 'claim_offer_communication_date', nullable: true })
  claimOfferCommunicationDate?: Date | null;

  @Column({
    name: 'claim_offer_amount',
    type: 'decimal',
    precision: 36,
    scale: 2,
  })
  claimOfferAmount!: string;

  @Column({ name: 'claimant_response_date', nullable: true })
  claimantResponseDate?: Date | null;

  @Column({ name: 'adjustment_date', nullable: true })
  adjustmentDate?: Date | null;

  @Column({ name: 'adjustment_reason', length: 1000, nullable: true })
  adjustmentReason?: string | null;

  @Column({
    name: 'adjustment_amount',
    type: 'decimal',
    precision: 36,
    scale: 2,
    nullable: true,
  })
  adjustmentAmount?: string | null;

  @Column({ name: 'reconciliation_date', nullable: true })
  reconciliationDate?: Date | null;

  @Column({ name: 'reconciliation_summary', type: 'text', nullable: true })
  reconciliationSummary?: string | null;

  @Column({
    name: 'reconciled_amount',
    type: 'decimal',
    precision: 36,
    scale: 2,
    nullable: true,
  })
  reconciledAmount?: string | null;

  @Column({ name: 'offer_accepted', length: 1, nullable: true })
  offerAccepted?: string | null;

  @OneToMany(() => TiramisClaimantEntity, (claimant) => claimant.dischargeVoucher, {
    cascade: true,
  })
  claimants?: TiramisClaimantEntity[];
}
