import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Company } from '../../../platform/companies/entities/company.entity';
import { Invoice } from '../../billing-commission/entities/invoice.entity';
import { Policy } from '../../policies/entities/policy.entity';
import { Quotation } from '../../quotations/entities/quotation.entity';
import { User } from '../../users/entities/user.entity';

import { PortalRequestStatus, PortalRequestType } from '../enums/portal.enums';

import { PortalAccount } from './portal-account.entity';
import { PortalPaymentProof } from './portal-payment-proof.entity';
import { PortalRequestAttachment } from './portal-request-attachment.entity';
import { PortalServiceRequestEvent } from './portal-service-request-event.entity';

@Entity('portal_service_requests')
@Index('IDX_portal_requests_company_status', [
  'company_id',
  'status',
  'request_type',
])
export class PortalServiceRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid' })
  portal_account_id: string;

  @Column({ type: 'varchar', length: 60 })
  request_no: string;

  @Column({ type: 'varchar', length: 50 })
  request_type: PortalRequestType;

  @Column({ type: 'varchar', length: 50, nullable: true })
  target_type: string | null;

  @Column({ type: 'uuid', nullable: true })
  target_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  policy_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  quotation_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  invoice_id: string | null;

  @Column({
    type: 'varchar',
    length: 40,
    default: PortalRequestStatus.DRAFT,
  })
  status: PortalRequestStatus;

  @Column({ type: 'varchar', length: 180 })
  subject: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  payload: Record<string, unknown>;

  @Column({ type: 'uuid', nullable: true })
  submitted_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  submitted_at: Date | null;

  @Column({ type: 'uuid', nullable: true })
  assigned_to: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  assigned_at: Date | null;

  @Column({ type: 'uuid', nullable: true })
  reviewed_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  reviewed_at: Date | null;

  @Column({ type: 'text', nullable: true })
  decision_reason: string | null;

  @Column({ type: 'uuid', nullable: true })
  completed_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  completed_at: Date | null;

  // Not a foreign key by design: this is an immutable audit value that must
  // outlive the creating user's account.
  @Column({ type: 'uuid' })
  created_by: string;

  @Column({ type: 'uuid', nullable: true })
  updated_by: string | null;

  // Set to `${portal_account_id}:${request_type}:${target_id}` for
  // policy/quotation requests while the request is open, and cleared to
  // null once it reaches a terminal status. A partial unique index on this
  // column is the DB-level backstop against two concurrent requests both
  // passing the application-level duplicate-open-request count check.
  @Column({ type: 'varchar', length: 250, nullable: true })
  active_dedupe_key: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @ManyToOne(() => PortalAccount, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'portal_account_id' })
  portal_account: PortalAccount;

  @ManyToOne(() => Policy, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'policy_id' })
  policy: Policy | null;

  @ManyToOne(() => Quotation, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'quotation_id' })
  quotation: Quotation | null;

  @ManyToOne(() => Invoice, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assigned_to' })
  assignee: User | null;

  @OneToMany(() => PortalServiceRequestEvent, (event) => event.request)
  events: PortalServiceRequestEvent[];

  @OneToMany(() => PortalRequestAttachment, (attachment) => attachment.request)
  attachments: PortalRequestAttachment[];

  @OneToOne(() => PortalPaymentProof, (proof) => proof.request)
  payment_proof: PortalPaymentProof | null;
}
