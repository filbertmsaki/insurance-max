import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'tiramis_claims' })
@Index(['transactionId'])
@Index(['requestId'])
@Index(['claimType'])
@Index(['claimNotificationNumber'])
@Index(['claimIntimationNumber'])
@Index(['claimAssessmentNumber'])
@Index(['dischargeVoucherNumber'])
@Index(['claimPaymentNumber'])
@Index(['claimRejectionNumber'])
@Index(['claimReferenceNumber'])
@Index(['coverNoteReferenceNumber'])
export class TiramisClaimEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'transaction_id', type: 'uuid' })
  transactionId!: string;

  @Column({ name: 'current_attempt_id', type: 'uuid', nullable: true })
  currentAttemptId?: string | null;

  @Column({ name: 'request_id', type: 'varchar', length: 100 })
  requestId!: string;

  @Column({ name: 'claim_type', type: 'varchar', length: 50 })
  claimType!: string;

  @Column({ name: 'service_type', type: 'varchar', length: 80 })
  serviceType!: string;

  @Column({ name: 'root_element', type: 'varchar', length: 100 })
  rootElement!: string;

  @Column({ name: 'company_code', type: 'varchar', length: 20 })
  companyCode!: string;

  @Column({ name: 'system_code', type: 'varchar', length: 30 })
  systemCode!: string;

  @Column({ name: 'callback_url', type: 'varchar', length: 500 })
  callbackUrl!: string;

  @Column({ name: 'insurer_company_code', type: 'varchar', length: 20 })
  insurerCompanyCode!: string;

  @Column({
    name: 'tran_company_code',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  tranCompanyCode?: string | null;

  @Column({
    name: 'claim_notification_number',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  claimNotificationNumber?: string | null;

  @Column({
    name: 'claim_intimation_number',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  claimIntimationNumber?: string | null;

  @Column({
    name: 'claim_assessment_number',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  claimAssessmentNumber?: string | null;

  @Column({
    name: 'discharge_voucher_number',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  dischargeVoucherNumber?: string | null;

  @Column({
    name: 'claim_payment_number',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  claimPaymentNumber?: string | null;

  @Column({
    name: 'claim_rejection_number',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  claimRejectionNumber?: string | null;

  @Column({
    name: 'claim_reference_number',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  claimReferenceNumber?: string | null;

  @Column({
    name: 'cover_note_reference_number',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  coverNoteReferenceNumber?: string | null;

  @Column({
    name: 'assessment_received_date',
    type: 'timestamptz',
    nullable: true,
  })
  assessmentReceivedDate?: Date | null;

  @Column({
    name: 'assessment_report_summary',
    type: 'text',
    nullable: true,
  })
  assessmentReportSummary?: string | null;

  @Column({
    name: 'assessment_amount',
    type: 'numeric',
    precision: 36,
    scale: 2,
    nullable: true,
  })
  assessmentAmount?: string | null;

  @Column({
    name: 'approved_claim_amount',
    type: 'numeric',
    precision: 36,
    scale: 2,
    nullable: true,
  })
  approvedClaimAmount?: string | null;

  @Column({
    name: 'claim_approval_date',
    type: 'timestamptz',
    nullable: true,
  })
  claimApprovalDate?: Date | null;

  @Column({
    name: 'claim_approval_authority',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  claimApprovalAuthority?: string | null;

  @Column({
    name: 'is_reassessment',
    type: 'varchar',
    length: 1,
    nullable: true,
  })
  isReAssessment?: string | null;

  @Column({
    name: 'claim_intimation_date',
    type: 'timestamptz',
    nullable: true,
  })
  claimIntimationDate?: Date | null;

  @Column({
    name: 'payment_date',
    type: 'timestamptz',
    nullable: true,
  })
  paymentDate?: Date | null;

  @Column({
    name: 'currency_code',
    type: 'varchar',
    length: 3,
    nullable: true,
  })
  currencyCode?: string | null;

  @Column({
    name: 'exchange_rate',
    type: 'numeric',
    precision: 36,
    scale: 2,
    nullable: true,
  })
  exchangeRate?: string | null;

  @Column({
    name: 'paid_amount',
    type: 'numeric',
    precision: 36,
    scale: 2,
    nullable: true,
  })
  paidAmount?: string | null;

  @Column({
    name: 'payment_mode',
    type: 'varchar',
    length: 1,
    nullable: true,
  })
  paymentMode?: string | null;

  @Column({
    name: 'parties_notified',
    type: 'varchar',
    length: 1,
    nullable: true,
  })
  partiesNotified?: string | null;

  @Column({
    name: 'net_premium_earned',
    type: 'numeric',
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
    type: 'text',
    nullable: true,
  })
  litigationReason?: string | null;

  @Column({
    name: 'rejection_date',
    type: 'timestamptz',
    nullable: true,
  })
  rejectionDate?: Date | null;

  @Column({
    name: 'rejection_reason',
    type: 'text',
    nullable: true,
  })
  rejectionReason?: string | null;

  @Column({
    name: 'claim_amount',
    type: 'numeric',
    precision: 36,
    scale: 2,
    nullable: true,
  })
  claimAmount?: string | null;

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

  @Column({
    name: 'claim_estimated_amount',
    type: 'numeric',
    precision: 36,
    scale: 2,
    nullable: true,
  })
  claimEstimatedAmount?: string | null;

  @Column({
    name: 'claim_reserve_amount',
    type: 'numeric',
    precision: 36,
    scale: 2,
    nullable: true,
  })
  claimReserveAmount?: string | null;

  @Column({
    name: 'claim_reserve_method',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  claimReserveMethod?: string | null;

  @Column({
    name: 'loss_assessment_option',
    type: 'int',
    nullable: true,
  })
  lossAssessmentOption?: number | null;

  @Column({
    name: 'assessor_name',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  assessorName?: string | null;

  @Column({
    name: 'assessor_id_number',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  assessorIdNumber?: string | null;

  @Column({
    name: 'assessor_id_type',
    type: 'int',
    nullable: true,
  })
  assessorIdType?: number | null;

  @Column({
    name: 'claimants',
    type: 'jsonb',
    nullable: true,
  })
  claimants?: Record<string, any>[] | null;

  @Column({
    name: 'claim_report_date',
    type: 'timestamptz',
    nullable: true,
  })
  claimReportDate?: Date | null;

  @Column({
    name: 'claim_form_dully_filled',
    type: 'varchar',
    length: 1,
    nullable: true,
  })
  claimFormDullyFilled?: string | null;

  @Column({
    name: 'loss_date',
    type: 'timestamptz',
    nullable: true,
  })
  lossDate?: Date | null;

  @Column({
    name: 'loss_nature',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  lossNature?: string | null;

  @Column({
    name: 'loss_type',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  lossType?: string | null;

  @Column({
    name: 'loss_location',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  lossLocation?: string | null;

  @Column({
    name: 'officer_name',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  officerName?: string | null;

  @Column({
    name: 'officer_title',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  officerTitle?: string | null;

  @Column({
    name: 'raw_data',
    type: 'jsonb',
    nullable: true,
  })
  rawData?: Record<string, any> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
