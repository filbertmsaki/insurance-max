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
import { TiramisCoverNoteAddonEntity } from './tiramis-cover-note-addon.entity';
import { TiramisCoverNoteRiskEntity } from './tiramis-cover-note-risk.entity';
import { TiramisPolicyHolderEntity } from './tiramis-policy-holder.entity';
import { TiramisSubjectMatterEntity } from './tiramis-subject-matter.entity';

@Entity({ name: 'tiramis_cover_notes' })
@Index(['coverNoteNumber'])
@Index(['coverNoteReferenceNumber'])
@Index(['requestId'])
export class TiramisCoverNoteEntity extends BaseEntity {
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

  @Column({ name: 'insurance_type', length: 30 })
  insuranceType!: string;

  @Column({ name: 'is_fleet', type: 'int', default: 0 })
  isFleet!: number;

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

  @Column({ name: 'tran_company_code', type: 'varchar', length: 6, nullable: true })
  tranCompanyCode?: string | null;

  @Column({ name: 'cover_note_type', type: 'int' })
  coverNoteType!: number;

  @Column({ name: 'cover_note_number', length: 50 })
  coverNoteNumber!: string;

  @Column({
    name: 'prev_cover_note_reference_number',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  prevCoverNoteReferenceNumber?: string | null;

  @Column({
    name: 'cover_note_reference_number',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  coverNoteReferenceNumber?: string | null;

  @Column({ name: 'sticker_number', type: 'varchar', length: 50, nullable: true })
  stickerNumber?: string | null;

  @Column({ name: 'sale_point_code', length: 12 })
  salePointCode!: string;

  @Column({ name: 'cover_note_start_date' })
  coverNoteStartDate!: Date;

  @Column({ name: 'cover_note_end_date' })
  coverNoteEndDate!: Date;

  @Column({ name: 'cover_note_desc', length: 1000 })
  coverNoteDesc!: string;

  @Column({ name: 'operative_clause', length: 1000 })
  operativeClause!: string;

  @Column({ name: 'payment_mode', type: 'int' })
  paymentMode!: number;

  @Column({ name: 'currency_code', length: 3 })
  currencyCode!: string;

  @Column({
    name: 'exchange_rate',
    type: 'decimal',
    precision: 36,
    scale: 2,
  })
  exchangeRate!: string;

  @Column({
    name: 'total_premium_excluding_tax',
    type: 'decimal',
    precision: 36,
    scale: 2,
  })
  totalPremiumExcludingTax!: string;

  @Column({
    name: 'total_premium_including_tax',
    type: 'decimal',
    precision: 36,
    scale: 2,
  })
  totalPremiumIncludingTax!: string;

  @Column({
    name: 'commission_paid',
    type: 'decimal',
    precision: 36,
    scale: 2,
    nullable: true,
  })
  commissionPaid?: string | null;

  @Column({
    name: 'commission_rate',
    type: 'decimal',
    precision: 10,
    scale: 5,
    nullable: true,
  })
  commissionRate?: string | null;

  @Column({ name: 'officer_name', length: 100 })
  officerName!: string;

  @Column({ name: 'officer_title', length: 100 })
  officerTitle!: string;

  @Column({ name: 'product_code', length: 50 })
  productCode!: string;

  @Column({ name: 'endorsement_type', type: 'int', nullable: true })
  endorsementType?: number | null;

  @Column({ name: 'endorsement_reason', type: 'varchar', length: 1000, nullable: true })
  endorsementReason?: string | null;

  @Column({
    name: 'endorsement_premium_earned',
    type: 'decimal',
    precision: 36,
    scale: 2,
    nullable: true,
  })
  endorsementPremiumEarned?: string | null;

  @OneToMany(() => TiramisCoverNoteRiskEntity, (risk) => risk.coverNote, {
    cascade: true,
  })
  risks?: TiramisCoverNoteRiskEntity[];

  @OneToMany(() => TiramisSubjectMatterEntity, (subject) => subject.coverNote, {
    cascade: true,
  })
  subjectMatters?: TiramisSubjectMatterEntity[];

  @OneToMany(() => TiramisCoverNoteAddonEntity, (addon) => addon.coverNote, {
    cascade: true,
  })
  addons?: TiramisCoverNoteAddonEntity[];

  @OneToMany(() => TiramisPolicyHolderEntity, (holder) => holder.coverNote, {
    cascade: true,
  })
  policyHolders?: TiramisPolicyHolderEntity[];
}
