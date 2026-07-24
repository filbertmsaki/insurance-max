import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { ApprovalStatus } from '../enums/approval-status.enum';
import { PaymentStatus } from '../enums/payment-status.enum';
import { QuotationStatus } from '../enums/quotation-status.enum';
import { TiraStatus } from '../enums/tira-status.enum';
import { Quotation } from './quotation.entity';

@Entity('quotation_status_history')
@Index('IDX_qsh_quotation_id', ['quotation_id'])
export class QuotationStatusHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  quotation_id: string;

  @Column({
    type: 'enum',
    enum: QuotationStatus,
    enumName: 'quotation_status_enum',
    nullable: true,
  })
  previous_quotation_status: QuotationStatus | null;

  @Column({
    type: 'enum',
    enum: QuotationStatus,
    enumName: 'quotation_status_enum',
    nullable: true,
  })
  new_quotation_status: QuotationStatus | null;

  @Column({
    type: 'enum',
    enum: ApprovalStatus,
    enumName: 'approval_status_enum',
    nullable: true,
  })
  previous_approval_status: ApprovalStatus | null;

  @Column({
    type: 'enum',
    enum: ApprovalStatus,
    enumName: 'approval_status_enum',
    nullable: true,
  })
  new_approval_status: ApprovalStatus | null;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    enumName: 'payment_status_enum',
    nullable: true,
  })
  previous_payment_status: PaymentStatus | null;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    enumName: 'payment_status_enum',
    nullable: true,
  })
  new_payment_status: PaymentStatus | null;

  @Column({
    type: 'enum',
    enum: TiraStatus,
    enumName: 'tira_status_enum',
    nullable: true,
  })
  previous_tira_status: TiraStatus | null;

  @Column({
    type: 'enum',
    enum: TiraStatus,
    enumName: 'tira_status_enum',
    nullable: true,
  })
  new_tira_status: TiraStatus | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  transition_type: string | null;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ type: 'text', nullable: true })
  comments: string | null;

  @Column({ type: 'uuid', nullable: true })
  changed_by: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  changed_by_type: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  source: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  channel: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  request_id: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  payment_transaction_id: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  tira_request_id: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  tira_response_id: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
  @ManyToOne(() => Quotation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'quotation_id' })
  quotation: Quotation;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'changed_by' })
  changer: User | null;

  get old_status(): QuotationStatus | null {
    return this.previous_quotation_status;
  }

  set old_status(value: QuotationStatus | null) {
    this.previous_quotation_status = value;
  }

  get new_status(): QuotationStatus | null {
    return this.new_quotation_status;
  }

  set new_status(value: QuotationStatus | null) {
    this.new_quotation_status = value;
  }
}
