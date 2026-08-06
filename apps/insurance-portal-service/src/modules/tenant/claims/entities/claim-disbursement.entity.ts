import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { ClaimDisbursementStatus } from '../enums/claim.enums';
import { InsuranceClaim } from './claim.entity';
import { ClaimPayment } from './claim-payment.entity';

@Entity('claim_disbursements')
@Unique('UQ_claim_disbursement_no', ['company_id', 'disbursement_no'])
@Unique('UQ_claim_disbursement_idempotency', ['company_id', 'idempotency_key'])
export class ClaimDisbursement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid' })
  claim_id: string;

  @Column({ type: 'uuid' })
  claim_payment_id: string;

  @Column({ type: 'varchar', length: 80 })
  disbursement_no: string;

  @Column({
    type: 'varchar',
    length: 30,
    default: ClaimDisbursementStatus.REQUESTED,
  })
  status: ClaimDisbursementStatus;

  @Column({ type: 'varchar', length: 40, nullable: true })
  payment_method: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 2 })
  amount: string;

  @Column({ type: 'varchar', length: 3 })
  currency_code: string;

  @Column({ type: 'jsonb', nullable: true })
  payee_snapshot: Record<string, unknown> | null;

  @Column({ type: 'uuid' })
  requested_by: string;

  @CreateDateColumn({ type: 'timestamptz' })
  requested_at: Date;

  @Column({ type: 'uuid', nullable: true })
  confirmed_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  confirmed_at: Date | null;

  @Column({ type: 'varchar', length: 180, nullable: true })
  provider_reference: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  failed_at: Date | null;

  @Column({ type: 'text', nullable: true })
  failure_message: string | null;

  @Column({ type: 'varchar', length: 180 })
  idempotency_key: string;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => InsuranceClaim, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'claim_id' })
  claim: InsuranceClaim;

  @ManyToOne(() => ClaimPayment, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'claim_payment_id' })
  claim_payment: ClaimPayment;
}
