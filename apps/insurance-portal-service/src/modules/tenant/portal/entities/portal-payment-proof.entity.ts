import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Invoice } from '../../billing-commission/entities/invoice.entity';

import { PortalPaymentProofStatus } from '../enums/portal.enums';

import { PortalServiceRequest } from './portal-service-request.entity';

/**
 * Verifying a payment proof must never itself mark the linked invoice PAID.
 * Only the finance module's receipt/allocation flow may do that.
 */
@Entity('portal_payment_proofs')
export class PortalPaymentProof {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid', unique: true })
  request_id: string;

  @Column({ type: 'uuid' })
  invoice_id: string;

  @Column({ type: 'numeric', precision: 20, scale: 2 })
  amount: string;

  @Column({ type: 'varchar', length: 10 })
  currency: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  payment_reference: string | null;

  @Column({ type: 'date' })
  payment_date: string;

  @Column({
    type: 'varchar',
    length: 30,
    default: PortalPaymentProofStatus.PENDING_REVIEW,
  })
  status: PortalPaymentProofStatus;

  @Column({ type: 'uuid', nullable: true })
  reviewed_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  reviewed_at: Date | null;

  @Column({ type: 'text', nullable: true })
  review_reason: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @OneToOne(() => PortalServiceRequest, (request) => request.payment_proof, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'request_id' })
  request: PortalServiceRequest;

  @ManyToOne(() => Invoice, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice;
}
