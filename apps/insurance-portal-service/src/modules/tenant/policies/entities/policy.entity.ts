import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Branch } from '../../branches/entities/branch.entity';
import { Company } from '../../../platform/companies/entities/company.entity';
import { Customer } from '../../customers/entities/customer.entity';
import { Department } from '../../departments/entities/department.entity';
import { InsuranceCategory } from '../../insurance-categories/entities/insurance-category.entity';
import { InsuranceProduct } from '../../insurance-products/entities/insurance-product.entity';
import { InsuranceSubClass } from '../../insurance-sub-classes/entities/insurance-sub-class.entity';
import { ProductChannelType } from '../../product-distribution/enums/product-channel-type.enum';
import { User } from '../../users/entities/user.entity';
import { PolicyCoverNote } from './policy-cover-note.entity';
import { PolicyPremiumBreakdown } from './policy-premium-breakdown.entity';
import { PolicyRisk } from './policy-risk.entity';
import { PolicyStatusHistory } from './policy-status-history.entity';
import { PolicyVersion } from './policy-version.entity';

@Entity('policies')
@Index('IDX_policies_company_id', ['company_id'])
@Index('IDX_policies_company_status', ['company_id', 'policy_status'])
@Index('IDX_policies_company_customer_id', ['company_id', 'customer_id'])
@Index('IDX_policies_company_product_id', ['company_id', 'product_id'])
@Index('IDX_policies_company_policy_no', ['company_id', 'policy_no'], {
  unique: true,
  where: 'deleted_at IS NULL',
})
@Index(
  'UQ_policies_issued_quotation_revision',
  ['company_id', 'quotation_id', 'source_quotation_revision'],
  {
    unique: true,
    where:
      'quotation_id IS NOT NULL ' +
      'AND source_quotation_revision IS NOT NULL ' +
      'AND deleted_at IS NULL',
  },
)
export class Policy {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

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

  @Column({ type: 'uuid' })
  customer_id: string;

  @Column({ type: 'uuid', nullable: true })
  quotation_id: string | null;

  @Column({ type: 'int', nullable: true })
  source_quotation_revision: number | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  source_finalization_hash: string | null;

  @Column({ type: 'uuid', nullable: true })
  proposal_id: string | null;

  @Column({ type: 'uuid' })
  category_id: string;

  @Column({ type: 'uuid' })
  product_id: string;

  @Column({ type: 'uuid', nullable: true })
  product_version_id: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  product_definition_hash: string | null;

  @Column({ type: 'uuid', nullable: true })
  sub_class_id: string | null;

  @Column({ type: 'varchar', length: 50 })
  policy_no: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  cover_note_no: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  external_policy_no: string | null;

  @Column({
    type: 'enum',
    enum: ProductChannelType,
    enumName: 'policy_channel_type_enum',
  })
  channel_type: ProductChannelType;

  @Column({ type: 'varchar', length: 20, default: 'DRAFT' })
  policy_status: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  policy_reference_number: string | null;

  @Column({ type: 'varchar', length: 40, default: 'PENDING' })
  regulatory_sync_status: string;

  @Column({ type: 'int', default: 0 })
  source_cover_note_count: number;

  @Column({ type: 'boolean', default: false })
  issued_by_system: boolean;

  @Column({ type: 'date' })
  start_date: string;

  @Column({ type: 'date' })
  end_date: string;

  @Column({ type: 'date' })
  issue_date: string;

  @Column({ type: 'timestamptz', nullable: true })
  activated_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  rejected_at: Date | null;

  @Column({ type: 'varchar', length: 10, default: 'TZS' })
  currency: string;

  @Column({ type: 'jsonb', nullable: true })
  customer_snapshot: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  customer_snapshot_hash: string | null;

  @Column({ type: 'jsonb', nullable: true })
  pricing_snapshot: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  pricing_result_hash: string | null;

  @Column({ type: 'jsonb', nullable: true })
  distribution_snapshot: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  distribution_snapshot_hash: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  sum_insured: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  basic_premium: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  total_discount: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  total_tax: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  total_charges: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  total_commission: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  total_premium: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  net_premium: string;

  @Column({ type: 'boolean', default: false })
  reinsurance_required: boolean;

  @Column({ type: 'varchar', length: 20, default: 'NOT_REQUIRED' })
  reinsurance_status: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  retention_amount: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  ceded_sum_insured: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  ceded_premium: string;

  @Column({ type: 'varchar', length: 20, default: 'PENDING' })
  tira_status: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  tira_portal_transaction_id: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  tiramis_transaction_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  tiramis_submission_tracking_id: string | null;

  @Column({ type: 'int', default: 1 })
  current_version_no: number;

  @Column({ type: 'uuid', nullable: true })
  renewed_from_policy_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  renewed_to_policy_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  active_version_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  pending_transaction_id: string | null;

  @Column({ type: 'date', nullable: true })
  last_endorsement_date: string | null;

  @Column({ type: 'date', nullable: true })
  cancellation_effective_date: string | null;

  @Column({ type: 'varchar', length: 40, default: 'NOT_STARTED' })
  renewal_status: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  tiramis_status: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  tiramis_request_id: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  tiramis_service_type: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  tiramis_root_element: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  tiramis_acknowledgement_status_code: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  tiramis_acknowledgement_status_desc: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  tiramis_final_response_id: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  tiramis_final_response_status_code: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  tiramis_final_response_status_desc: string | null;

  @Column({ type: 'text', nullable: true })
  tiramis_last_error_message: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  tiramis_last_synced_at: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  tiramis_payload: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  regulatory_response_payload: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  regulatory_response_hash: string | null;

  @Column({ type: 'int', default: 1 })
  state_version: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

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

  @ManyToOne(() => Customer, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @ManyToOne(() => InsuranceCategory, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'category_id' })
  category: InsuranceCategory;

  @ManyToOne(() => InsuranceProduct, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_id' })
  product: InsuranceProduct;

  @ManyToOne(() => InsuranceSubClass, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'sub_class_id' })
  sub_class: InsuranceSubClass | null;

  @OneToMany(() => PolicyRisk, (risk) => risk.policy)
  risks: PolicyRisk[];

  @OneToMany(() => PolicyPremiumBreakdown, (item) => item.policy)
  premium_breakdowns: PolicyPremiumBreakdown[];

  @OneToMany(() => PolicyStatusHistory, (history) => history.policy)
  status_history: PolicyStatusHistory[];

  @OneToMany(() => PolicyCoverNote, (link) => link.policy)
  cover_note_links: PolicyCoverNote[];

  @OneToMany(() => PolicyVersion, (version) => version.policy)
  versions: PolicyVersion[];
}
