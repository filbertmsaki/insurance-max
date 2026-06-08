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

@Entity({ name: 'tiramis_claim_assessments' })
@Index(['requestId'])
@Index(['claimAssessmentNumber'])
@Index(['claimReferenceNumber'])
export class TiramisClaimAssessmentEntity extends BaseEntity {
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

  @Column({ name: 'claim_assessment_number', length: 50 })
  claimAssessmentNumber!: string;

  @Column({ name: 'claim_intimation_number', length: 50 })
  claimIntimationNumber!: string;

  @Column({ name: 'claim_reference_number', length: 50 })
  claimReferenceNumber!: string;

  @Column({ name: 'cover_note_reference_number', length: 50 })
  coverNoteReferenceNumber!: string;

  @Column({ name: 'assessment_received_date' })
  assessmentReceivedDate!: Date;

  @Column({ name: 'assessment_report_summary', type: 'text', nullable: true })
  assessmentReportSummary?: string | null;

  @Column({ name: 'currency_code', length: 3 })
  currencyCode!: string;

  @Column({ name: 'exchange_rate', type: 'decimal', precision: 36, scale: 2 })
  exchangeRate!: string;

  @Column({
    name: 'assessment_amount',
    type: 'decimal',
    precision: 36,
    scale: 2,
  })
  assessmentAmount!: string;

  @Column({
    name: 'approved_claim_amount',
    type: 'decimal',
    precision: 36,
    scale: 2,
  })
  approvedClaimAmount!: string;

  @Column({ name: 'claim_approval_date', type: 'timestamp', nullable: true })
  claimApprovalDate?: Date | null;

  @Column({
    name: 'claim_approval_authority',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  claimApprovalAuthority?: string | null;

  @Column({
    name: 'is_re_assessment',
    type: 'varchar',
    length: 1,
    nullable: true,
  })
  isReAssessment?: string | null;

  @OneToMany(
    () => TiramisClaimantEntity,
    (claimant) => claimant.claimAssessment,
    {
      cascade: true,
    },
  )
  claimants?: TiramisClaimantEntity[];
}
