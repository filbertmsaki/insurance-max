import { BaseEntity } from '@insurance-max/persistence';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';

import { TiramisClaimAssessmentEntity } from './tiramis-claim-assessment.entity';
import { TiramisClaimIntimationEntity } from './tiramis-claim-intimation.entity';
import { TiramisClaimPaymentEntity } from './tiramis-claim-payment.entity';
import { TiramisClaimRejectionEntity } from './tiramis-claim-rejection.entity';
import { TiramisDischargeVoucherEntity } from './tiramis-discharge-voucher.entity';

@Entity({ name: 'tiramis_claimants' })
export class TiramisClaimantEntity extends BaseEntity {
  @Column({ name: 'claim_intimation_id', nullable: true })
  claimIntimationId?: string | null;

  @ManyToOne(() => TiramisClaimIntimationEntity, (claim) => claim.claimants, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'claim_intimation_id' })
  claimIntimation?: TiramisClaimIntimationEntity | null;

  @Column({ name: 'claim_assessment_id', nullable: true })
  claimAssessmentId?: string | null;

  @ManyToOne(() => TiramisClaimAssessmentEntity, (claim) => claim.claimants, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'claim_assessment_id' })
  claimAssessment?: TiramisClaimAssessmentEntity | null;

  @Column({ name: 'discharge_voucher_id', nullable: true })
  dischargeVoucherId?: string | null;

  @ManyToOne(
    () => TiramisDischargeVoucherEntity,
    (claim) => claim.claimants,
    {
      nullable: true,
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'discharge_voucher_id' })
  dischargeVoucher?: TiramisDischargeVoucherEntity | null;

  @Column({ name: 'claim_payment_id', nullable: true })
  claimPaymentId?: string | null;

  @ManyToOne(() => TiramisClaimPaymentEntity, (claim) => claim.claimants, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'claim_payment_id' })
  claimPayment?: TiramisClaimPaymentEntity | null;

  @Column({ name: 'claim_rejection_id', nullable: true })
  claimRejectionId?: string | null;

  @ManyToOne(() => TiramisClaimRejectionEntity, (claim) => claim.claimants, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'claim_rejection_id' })
  claimRejection?: TiramisClaimRejectionEntity | null;

  @Column({ name: 'claimant_name', length: 100 })
  claimantName!: string;

  @Column({ name: 'claimant_birth_date', type: 'date', nullable: true })
  claimantBirthDate?: Date | null;

  @Column({ name: 'claimant_category', type: 'int' })
  claimantCategory!: number;

  @Column({ name: 'claimant_type', type: 'int' })
  claimantType!: number;

  @Column({ name: 'claimant_id_number', length: 50 })
  claimantIdNumber!: string;

  @Column({ name: 'claimant_id_type', type: 'int' })
  claimantIdType!: number;

  @Column({ length: 1, nullable: true })
  gender?: string | null;

  @Column({ name: 'country_code', length: 3 })
  countryCode!: string;

  @Column({ length: 50 })
  region!: string;

  @Column({ length: 50 })
  district!: string;

  @Column({ length: 50, nullable: true })
  street?: string | null;

  @Column({ name: 'claimant_phone_number', length: 50 })
  claimantPhoneNumber!: string;

  @Column({ name: 'claimant_fax', length: 50, nullable: true })
  claimantFax?: string | null;

  @Column({ name: 'postal_address', length: 100, nullable: true })
  postalAddress?: string | null;

  @Column({ name: 'email_address', length: 100, nullable: true })
  emailAddress?: string | null;
}
