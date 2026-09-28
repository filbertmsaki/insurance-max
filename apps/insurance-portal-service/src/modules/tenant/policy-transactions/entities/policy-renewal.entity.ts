import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import type { RenewalLifecycleStatus } from '@insurance-max/contracts';

import { Policy } from '../../policies/entities/policy.entity';
import { Quotation } from '../../quotations/entities/quotation.entity';
import { PolicyTransaction } from './policy-transaction.entity';

@Entity('policy_renewals')
@Unique('UQ_policy_renewal_no', ['company_id', 'renewal_no'])
export class PolicyRenewal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid' })
  policy_transaction_id: string;

  @Column({ type: 'varchar', length: 80 })
  renewal_no: string;

  @Column({ type: 'varchar', length: 40, default: 'ELIGIBLE' })
  renewal_status: RenewalLifecycleStatus;

  @Column({ type: 'date' })
  renewal_start_date: string;

  @Column({ type: 'date' })
  renewal_end_date: string;

  @Column({ type: 'timestamptz', nullable: true })
  offer_expires_at: Date | null;

  @Column({ type: 'varchar', length: 100 })
  source_cover_note_reference: string;

  @Column({ type: 'uuid', nullable: true })
  previous_policy_id: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  previous_cover_note_reference_number: string | null;

  @Column({ type: 'uuid', nullable: true })
  renewal_of_policy_id: string | null;

  @Column({ type: 'int', default: 1 })
  renewal_sequence: number;

  @Column({ type: 'uuid', nullable: true })
  renewal_quotation_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  renewed_policy_id: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  customer_accepted_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  customer_declined_at: Date | null;

  @Column({ type: 'text', nullable: true })
  decline_reason: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @OneToOne(() => PolicyTransaction, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'policy_transaction_id' })
  policy_transaction: PolicyTransaction;

  @ManyToOne(() => Quotation, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'renewal_quotation_id' })
  renewal_quotation: Quotation | null;

  @ManyToOne(() => Policy, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'renewed_policy_id' })
  renewed_policy: Policy | null;
}
