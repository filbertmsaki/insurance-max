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

@Entity({ name: 'tiramis_claim_payments' })
@Index(['requestId'])
@Index(['claimPaymentNumber'])
@Index(['claimReferenceNumber'])
export class TiramisClaimPaymentEntity extends BaseEntity {
  @Column({ name: 'transaction_id' })
  transactionId!: string;

  @ManyToOne(() => TiramisTransactionEntity)
  @JoinColumn({ name: 'transaction_id' })
  transaction!: TiramisTransactionEntity;

  @Column({ name: 'current_attempt_id', type: 'uuid', nullable: true })
  currentAttemptId?: string | null;

  @ManyToOne(() => TiramisSubmissionAttemptEntity, { nullable: true })
  @JoinColumn({ name: 'current_attempt_id' })
  currentAttempt?: TiramisSubmissionAttemptEntity | null;

  @Column({ name: 'request_id', length: 50 })
  requestId!: string;

  @Column({ name: 'company_code', length: 6 })
  companyCode!: string;

  @Column({ name: 'system_code', length: 50 })
  systemCode!: string;

  @Column({ name: 'callback_url', length: 250 })
  callbackUrl!: string;

  @Column({ name: 'insurer_company_code', length: 6 })
  insurerCompanyCode!: string;

  @Column({ name: 'claim_payment_number', length: 50 })
  claimPaymentNumber!: string;

  @Column({ name: 'claim_reference_number', length: 50 })
  claimReferenceNumber!: string;

  @Column({ name: 'claim_intimation_number', length: 50 })
  claimIntimationNumber!: string;

  @Column({ name: 'cover_note_reference_number', length: 50 })
  coverNoteReferenceNumber!: string;

  @Column({ name: 'payment_date' })
  paymentDate!: Date;

  @Column({ name: 'paid_amount', type: 'decimal', precision: 36, scale: 2 })
  paidAmount!: string;

  @Column({ name: 'payment_mode', type: 'int' })
  paymentMode!: number;

  @Column({
    name: 'parties_notified',
    type: 'varchar',
    length: 1,
    nullable: true,
  })
  partiesNotified?: string | null;

  @Column({
    name: 'net_premium_earned',
    type: 'decimal',
    precision: 36,
    scale: 2,
    nullable: true,
  })
  netPremiumEarned?: string | null;

  @Column({
    name: 'claim_resulted_litigation',
    type: 'varchar',
    length: 1,
    nullable: true,
  })
  claimResultedLitigation?: string | null;

  @Column({
    name: 'litigation_reason',
    type: 'varchar',
    length: 1000,
    nullable: true,
  })
  litigationReason?: string | null;

  @Column({ name: 'currency_code', length: 3 })
  currencyCode!: string;

  @Column({ name: 'exchange_rate', type: 'decimal', precision: 36, scale: 2 })
  exchangeRate!: string;

  @OneToMany(() => TiramisClaimantEntity, (claimant) => claimant.claimPayment, {
    cascade: true,
  })
  claimants?: TiramisClaimantEntity[];
}
