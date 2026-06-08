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

@Entity({ name: 'tiramis_claim_intimations' })
@Index(['requestId'])
@Index(['claimIntimationNumber'])
@Index(['claimReferenceNumber'])
@Index(['coverNoteReferenceNumber'])
export class TiramisClaimIntimationEntity extends BaseEntity {
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

  @Column({ name: 'claim_intimation_number', length: 50 })
  claimIntimationNumber!: string;

  @Column({ name: 'claim_reference_number', length: 50 })
  claimReferenceNumber!: string;

  @Column({ name: 'cover_note_reference_number', length: 50 })
  coverNoteReferenceNumber!: string;

  @Column({ name: 'claim_intimation_date' })
  claimIntimationDate!: Date;

  @Column({ name: 'currency_code', length: 3 })
  currencyCode!: string;

  @Column({ name: 'exchange_rate', type: 'decimal', precision: 36, scale: 2 })
  exchangeRate!: string;

  @Column({
    name: 'claim_estimated_amount',
    type: 'decimal',
    precision: 36,
    scale: 2,
  })
  claimEstimatedAmount!: string;

  @Column({
    name: 'claim_reserve_amount',
    type: 'decimal',
    precision: 36,
    scale: 2,
  })
  claimReserveAmount!: string;

  @Column({ name: 'claim_reserve_method', length: 100 })
  claimReserveMethod!: string;

  @Column({ name: 'loss_assessment_option', type: 'int' })
  lossAssessmentOption!: number;

  @Column({
    name: 'assessor_name',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  assessorName?: string | null;

  @Column({
    name: 'assessor_id_number',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  assessorIdNumber?: string | null;

  @Column({ name: 'assessor_id_type', type: 'int', nullable: true })
  assessorIdType?: number | null;

  @OneToMany(
    () => TiramisClaimantEntity,
    (claimant) => claimant.claimIntimation,
    {
      cascade: true,
    },
  )
  claimants?: TiramisClaimantEntity[];
}
