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
import { Branch } from '../../branches/entities/branch.entity';
import { Customer } from '../../customers/entities/customer.entity';
import { Department } from '../../departments/entities/department.entity';
import { InsuranceCategory } from '../../insurance-categories/entities/insurance-category.entity';
import { InsuranceProduct } from '../../insurance-products/entities/insurance-product.entity';
import { InsuranceSubClass } from '../../insurance-sub-classes/entities/insurance-sub-class.entity';
import { ProductChannelType } from '../../product-distribution/enums/product-channel-type.enum';
import { User } from '../../users/entities/user.entity';
import { ApprovalStatus } from '../enums/approval-status.enum';
import { PaymentStatus } from '../enums/payment-status.enum';
import { QuotationFlow } from '../enums/quotation-flow.enum';
import { QuotationStatus } from '../enums/quotation-status.enum';
import { TiraStatus } from '../enums/tira-status.enum';
import { QuotationType } from '../enums/quotation-type.enum';
import { QuotationStatusHistory } from './quotation-status-history.entity';
import { QuotationCoverNote } from './structured/quotation-cover-note.entity';
import { QuotationPolicyHolder } from './structured/quotation-policy-holder.entity';

@Entity('quotations')
@Index('IDX_quotations_company_id', ['company_id'])
@Index('IDX_quotations_company_status', ['company_id', 'status'])
@Index('IDX_quotations_company_approval_status', [
  'company_id',
  'approval_status',
])
@Index('IDX_quotations_company_payment_status', [
  'company_id',
  'payment_status',
])
@Index('IDX_quotations_company_tira_status', ['company_id', 'tira_status'])
@Index('IDX_quotations_company_customer_id', ['company_id', 'customer_id'])
@Index('IDX_quotations_company_product_id', ['company_id', 'product_id'])
@Index('IDX_quotations_company_flow', ['company_id', 'quotation_flow'])
@Index('IDX_quotations_company_quotation_no', ['company_id', 'quotation_no'], {
  unique: true,
  where: 'deleted_at IS NULL',
})
export class Quotation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Tenant that owns the quotation.
   */
  @Column({ type: 'uuid' })
  company_id: string;

  /**
   * Insurance company responsible for issuing the cover.
   */
  @Column({ type: 'uuid' })
  insurer_company_id: string;

  @Column({ type: 'uuid', nullable: true })
  intermediary_company_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  branch_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  department_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @Column({ type: 'uuid', nullable: true })
  updated_by: string | null;

  @Column({ type: 'uuid', nullable: true })
  submitted_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  submitted_at: Date | null;

  /**
   * Optional internal customer link.
   *
   * This field is not exposed in the authoritative TIRAMIS payload.
   * Policyholder data is stored separately.
   */
  @Column({ type: 'uuid', nullable: true })
  customer_id: string | null;

  @Column({ type: 'uuid' })
  category_id: string;

  @Column({ type: 'uuid' })
  product_id: string;

  @Column({ type: 'uuid', nullable: true })
  sub_class_id: string | null;

  @Column({ length: 30 })
  quotation_no: string;

  @Column({
    type: 'enum',
    enum: QuotationType,
    enumName: 'quotation_type_enum',
  })
  quotation_type: QuotationType;

  @Column({
    type: 'enum',
    enum: QuotationFlow,
    enumName: 'quotation_flow_enum',
    default: QuotationFlow.NON_MOTOR,
  })
  quotation_flow: QuotationFlow;

  @Column({ type: 'boolean', default: false })
  is_fleet: boolean;

  @Column({
    type: 'enum',
    enum: ProductChannelType,
    enumName: 'quotation_channel_type_enum',
  })
  channel_type: ProductChannelType;

  @Column({
    type: 'enum',
    enum: QuotationStatus,
    enumName: 'quotation_status_enum',
    name: 'quotation_status',
    default: QuotationStatus.DRAFT,
  })
  status: QuotationStatus;

  @Column({ type: 'boolean', default: false })
  requires_approval: boolean;

  @Column({ type: 'boolean', default: false })
  requires_payment: boolean;

  @Column({
    type: 'enum',
    enum: ApprovalStatus,
    enumName: 'approval_status_enum',
    default: ApprovalStatus.NOT_REQUIRED,
  })
  approval_status: ApprovalStatus;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    enumName: 'payment_status_enum',
    default: PaymentStatus.NOT_REQUIRED,
  })
  payment_status: PaymentStatus;

  @Column({
    type: 'enum',
    enum: TiraStatus,
    enumName: 'tira_status_enum',
    default: TiraStatus.NOT_SUBMITTED,
  })
  tira_status: TiraStatus;

  @Column({ type: 'uuid', nullable: true })
  approval_submitted_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  approval_submitted_at: Date | null;

  @Column({ type: 'uuid', nullable: true })
  approval_decided_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  approval_decided_at: Date | null;

  @Column({ type: 'text', nullable: true })
  approval_comments: string | null;

  @Column({ type: 'text', nullable: true })
  approval_reason: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  payment_request_reference: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  payment_requested_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  payment_completed_at: Date | null;

  @Column({ type: 'text', nullable: true })
  payment_failure_reason: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  tira_request_id: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  tira_response_id: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  tira_response_code: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  tira_response_description: string | null;

  @Column({ type: 'jsonb', nullable: true })
  tira_error_details: Record<string, unknown> | null;

  @Column({ type: 'text', nullable: true })
  rejection_reason: string | null;

  @Column({ type: 'text', nullable: true })
  cancellation_reason: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  current_wizard_step: string | null;

  @Column({ type: 'jsonb', nullable: true })
  draft_payload: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'insurer_company_id' })
  insurer_company: Company;

  @ManyToOne(() => Company, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'intermediary_company_id' })
  intermediary_company: Company | null;

  @ManyToOne(() => Branch, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'branch_id' })
  branch: Branch | null;

  @ManyToOne(() => Department, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'department_id' })
  department: Department | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  creator: User | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'updated_by' })
  updater: User | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'submitted_by' })
  submitter: User | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'approval_submitted_by' })
  approval_submitter: User | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'approval_decided_by' })
  approval_decider: User | null;

  @ManyToOne(() => Customer, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer | null;

  @ManyToOne(() => InsuranceCategory, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'category_id' })
  category: InsuranceCategory;

  @ManyToOne(() => InsuranceProduct, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_id' })
  product: InsuranceProduct;

  @ManyToOne(() => InsuranceSubClass, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'sub_class_id' })
  sub_class: InsuranceSubClass | null;

  @OneToOne(() => QuotationCoverNote, (coverNote) => coverNote.quotation)
  cover_note: QuotationCoverNote;

  @OneToMany(() => QuotationPolicyHolder, (holder) => holder.quotation)
  policy_holders: QuotationPolicyHolder[];

  @OneToMany(() => QuotationStatusHistory, (history) => history.quotation)
  status_history: QuotationStatusHistory[];
}
