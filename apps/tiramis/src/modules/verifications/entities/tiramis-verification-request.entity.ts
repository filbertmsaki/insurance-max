import { BaseEntity } from '@insurance-max/persistence';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
} from 'typeorm';

import { TiramisSubmissionAttemptEntity } from '../../submissions/entities/tiramis-submission-attempt.entity';
import { TiramisTransactionEntity } from '../../submissions/entities/tiramis-transaction.entity';
import { TiramisVerificationResponseEntity } from './tiramis-verification-response.entity';

@Entity({ name: 'tiramis_verification_requests' })
@Index(['requestId'])
@Index(['verificationType'])
@Index(['coverNoteReferenceNumber'])
@Index(['stickerNumber'])
@Index(['motorRegistrationNumber'])
@Index(['motorChassisNumber'])
@Index(['nin'])
@Index(['incorporationCertificateNumber'])
export class TiramisVerificationRequestEntity extends BaseEntity {
  @Column({ name: 'transaction_id', type: 'uuid', nullable: true })
  transactionId?: string | null;

  @ManyToOne(() => TiramisTransactionEntity, { nullable: true })
  @JoinColumn({ name: 'transaction_id' })
  transaction?: TiramisTransactionEntity | null;

  @Column({ name: 'attempt_id', type: 'uuid', nullable: true })
  attemptId?: string | null;

  @ManyToOne(() => TiramisSubmissionAttemptEntity, { nullable: true })
  @JoinColumn({ name: 'attempt_id' })
  attempt?: TiramisSubmissionAttemptEntity | null;

  @Column({ name: 'verification_type', length: 50 })
  verificationType!: string;

  @Column({ name: 'request_id', length: 50 })
  requestId!: string;

  @Column({ name: 'company_code', length: 6 })
  companyCode!: string;

  @Column({ name: 'system_code', length: 50 })
  systemCode!: string;

  // Nullable preserves historical non-motor and pre-migration records.
  // New motor verification requests are validated before persistence.
  @Column({ name: 'motor_category', type: 'int', nullable: true })
  motorCategory?: number | null;

  @Column({
    name: 'cover_note_reference_number',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  coverNoteReferenceNumber?: string | null;

  @Column({
    name: 'sticker_number',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  stickerNumber?: string | null;

  @Column({
    name: 'motor_registration_number',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  motorRegistrationNumber?: string | null;

  @Column({
    name: 'motor_chassis_number',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  motorChassisNumber?: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  nin?: string | null;

  @Column({
    name: 'incorporation_certificate_number',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  incorporationCertificateNumber?: string | null;

  @Column({ name: 'raw_request_xml', type: 'text', nullable: true })
  rawRequestXml?: string | null;

  @Column({ name: 'request_signature', type: 'text', nullable: true })
  requestSignature?: string | null;

  @Column({ length: 50, default: 'PENDING' })
  status!: string;

  @OneToOne(
    () => TiramisVerificationResponseEntity,
    (response) => response.verificationRequest,
  )
  response?: TiramisVerificationResponseEntity;
}
