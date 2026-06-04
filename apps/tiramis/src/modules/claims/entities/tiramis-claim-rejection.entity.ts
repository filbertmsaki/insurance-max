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

@Entity({ name: 'tiramis_claim_rejections' })
@Index(['requestId'])
@Index(['claimRejectionNumber'])
@Index(['claimReferenceNumber'])
export class TiramisClaimRejectionEntity extends BaseEntity {
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

  @Column({ name: 'claim_rejection_number', length: 50 })
  claimRejectionNumber!: string;

  @Column({ name: 'claim_reference_number', length: 50 })
  claimReferenceNumber!: string;

  @Column({ name: 'cover_note_reference_number', length: 50 })
  coverNoteReferenceNumber!: string;

  @Column({ name: 'rejection_date' })
  rejectionDate!: Date;

  @Column({ name: 'rejection_reason', length: 1000 })
  rejectionReason!: string;

  @OneToMany(() => TiramisClaimantEntity, (claimant) => claimant.claimRejection, {
    cascade: true,
  })
  claimants?: TiramisClaimantEntity[];
}
