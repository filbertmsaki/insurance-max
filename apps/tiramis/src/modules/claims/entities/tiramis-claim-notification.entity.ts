import { BaseEntity } from '@insurance-max/persistence';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { TiramisSubmissionAttemptEntity } from '../../submissions/entities/tiramis-submission-attempt.entity';
import { TiramisTransactionEntity } from '../../submissions/entities/tiramis-transaction.entity';

@Entity({ name: 'tiramis_claim_notifications' })
@Index(['requestId'])
@Index(['claimNotificationNumber'])
@Index(['coverNoteReferenceNumber'])
export class TiramisClaimNotificationEntity extends BaseEntity {
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

  @Column({
    name: 'tran_company_code',
    type: 'varchar',
    length: 6,
    nullable: true,
  })
  tranCompanyCode?: string | null;

  @Column({ name: 'claim_notification_number', length: 50 })
  claimNotificationNumber!: string;

  @Column({ name: 'cover_note_reference_number', length: 50 })
  coverNoteReferenceNumber!: string;

  @Column({ name: 'claim_report_date' })
  claimReportDate!: Date;

  @Column({
    name: 'claim_form_dully_filled',
    type: 'varchar',
    length: 10,
    nullable: true,
  })
  claimFormDullyFilled?: string | null;

  @Column({ name: 'loss_date' })
  lossDate!: Date;

  @Column({ name: 'loss_nature', type: 'varchar', length: 255, nullable: true })
  lossNature?: string | null;

  @Column({ name: 'loss_type', type: 'varchar', length: 100, nullable: true })
  lossType?: string | null;

  @Column({
    name: 'loss_location',
    type: 'varchar',
    length: 250,
    nullable: true,
  })
  lossLocation?: string | null;

  @Column({ name: 'officer_name', length: 100 })
  officerName!: string;

  @Column({ name: 'officer_title', length: 100 })
  officerTitle!: string;
}
