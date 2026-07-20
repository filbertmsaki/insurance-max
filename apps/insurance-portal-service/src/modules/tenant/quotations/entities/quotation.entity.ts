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
import { QuotationFlow } from '../enums/quotation-flow.enum';
import { QuotationStatus } from '../enums/quotation-status.enum';
import { QuotationType } from '../enums/quotation-type.enum';
import { QuotationStatusHistory } from './quotation-status-history.entity';
import { QuotationCoverNote } from './structured/quotation-cover-note.entity';
import { QuotationPolicyHolder } from './structured/quotation-policy-holder.entity';

@Entity('quotations')
@Index('IDX_quotations_company_id', ['company_id'])
@Index('IDX_quotations_company_status', ['company_id', 'status'])
@Index('IDX_quotations_company_customer_id', ['company_id', 'customer_id'])
@Index('IDX_quotations_company_product_id', ['company_id', 'product_id'])
@Index('IDX_quotations_company_flow', ['company_id', 'quotation_flow'])
@Index(
  'IDX_quotations_company_quotation_no',
  ['company_id', 'quotation_no'],
  {
    unique: true,
    where: 'deleted_at IS NULL',
  },
)
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
    default: QuotationStatus.DRAFT,
  })
  status: QuotationStatus;

  @Column({ type: 'text', nullable: true })
  rejection_reason: string | null;

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

  @OneToOne(
    () => QuotationCoverNote,
    (coverNote) => coverNote.quotation,
  )
  cover_note: QuotationCoverNote;

  @OneToMany(
    () => QuotationPolicyHolder,
    (holder) => holder.quotation,
  )
  policy_holders: QuotationPolicyHolder[];

  @OneToMany(() => QuotationStatusHistory, (history) => history.quotation)
  status_history: QuotationStatusHistory[];
}
