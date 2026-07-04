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
import { TiramisReinsuranceParticipantEntity } from './tiramis-reinsurance-participant.entity';

@Entity({ name: 'tiramis_reinsurances' })
@Index(['requestId'])
@Index(['coverNoteReferenceNumber'])
export class TiramisReinsuranceEntity extends BaseEntity {
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

  @Column({ name: 'cover_note_reference_number', length: 50 })
  coverNoteReferenceNumber!: string;

  @Column({
    name: 'premium_including_tax',
    type: 'decimal',
    precision: 36,
    scale: 2,
  })
  premiumIncludingTax!: string;

  @Column({ name: 'currency_code', length: 3 })
  currencyCode!: string;

  @Column({
    name: 'exchange_rate',
    type: 'decimal',
    precision: 36,
    scale: 2,
  })
  exchangeRate!: string;

  @Column({ name: 'authorizing_officer_name', length: 100 })
  authorizingOfficerName!: string;

  @Column({ name: 'authorizing_officer_title', length: 100 })
  authorizingOfficerTitle!: string;

  @Column({ name: 'reinsurance_category', type: 'int' })
  reinsuranceCategory!: number;

  @Column({
    name: 'final_response_id',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  finalResponseId?: string | null;

  @Column({
    name: 'final_response_status_code',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  finalResponseStatusCode?: string | null;

  @Column({
    name: 'final_response_status_desc',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  finalResponseStatusDesc?: string | null;

  @Column({
    name: 'final_response_received_at',
    type: 'timestamptz',
    nullable: true,
  })
  finalResponseReceivedAt?: Date | null;

  @Column({
    name: 'final_response_payload',
    type: 'jsonb',
    nullable: true,
  })
  finalResponsePayload?: Record<string, any> | null;

  @OneToMany(
    () => TiramisReinsuranceParticipantEntity,
    (participant) => participant.reinsurance,
    {
      cascade: true,
    },
  )
  participants?: TiramisReinsuranceParticipantEntity[];
}
