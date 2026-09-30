import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import type {
  CoverNoteLifecycleStatus,
  RegulatorySyncStatus,
} from '@insurance-max/contracts';

import { Company } from '../../../platform/companies/entities/company.entity';
import { TiramisSubmissionTrackingEntity } from '../../../tiramis/entities/tiramis-submission-tracking.entity';
import { Customer } from '../../customers/entities/customer.entity';
import { InsuredAsset } from '../../customers/entities/insured-asset.entity';
import { Policy } from '../../policies/entities/policy.entity';
import { Quotation } from '../../quotations/entities/quotation.entity';
import { QuotationCoverNoteEntry } from '../../quotations/entities/structured/quotation-cover-note-entry.entity';

@Entity('cover_notes')
@Index('UQ_cover_note_quotation_entry', ['quotation_entry_id'], {
  unique: true,
  where: 'deleted_at IS NULL',
})
@Index(
  'UQ_cover_note_regulatory_reference',
  ['insurer_company_id', 'cover_note_reference_number'],
  {
    unique: true,
    where: 'cover_note_reference_number IS NOT NULL AND deleted_at IS NULL',
  },
)
@Index('IDX_cover_note_customer', ['company_id', 'customer_id', 'status'])
export class CoverNote {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  company_id!: string;

  @Column({ type: 'uuid' })
  insurer_company_id!: string;

  @Column({ type: 'uuid', nullable: true })
  intermediary_company_id!: string | null;

  @Column({ type: 'uuid', nullable: true })
  branch_id!: string | null;

  @Column({ type: 'uuid', nullable: true })
  sale_point_id!: string | null;

  @Column({ type: 'uuid' })
  customer_id!: string;

  @Column({ type: 'uuid' })
  quotation_id!: string;

  /** Null for a vehicle added to a fleet by endorsement (no quotation entry). */
  @Column({ type: 'uuid', nullable: true })
  quotation_entry_id!: string | null;

  @Column({ type: 'uuid', nullable: true })
  policy_id!: string | null;

  @Column({ type: 'uuid', nullable: true })
  insured_asset_id!: string | null;

  @Column({ type: 'uuid' })
  tiramis_tracking_id!: string;

  @Column({ type: 'varchar', length: 100 })
  tiramis_transaction_id!: string;

  @Column({ type: 'varchar', length: 100 })
  tiramis_request_id!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  response_id!: string | null;

  @Column({ type: 'varchar', length: 100 })
  cover_note_number!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  cover_note_reference_number!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  sticker_number!: string | null;

  @Column({ type: 'varchar', length: 40 })
  entry_type!: string;

  @Column({ type: 'int', nullable: true })
  fleet_entry!: number | null;

  @Column({
    type: 'varchar',
    length: 40,
    default: 'PENDING_SUBMISSION',
  })
  status!: CoverNoteLifecycleStatus | string;

  @Column({
    type: 'varchar',
    length: 40,
    default: 'PENDING',
  })
  regulatory_sync_status!: RegulatorySyncStatus | string;

  @Column({ type: 'uuid' })
  product_id!: string;

  @Column({ type: 'uuid', nullable: true })
  product_version_id!: string | null;

  @Column({ type: 'varchar', length: 50 })
  product_code!: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  product_definition_hash!: string | null;

  @Column({ type: 'jsonb' })
  customer_snapshot!: Record<string, unknown>;

  @Column({ type: 'varchar', length: 64 })
  customer_snapshot_hash!: string;

  @Column({ type: 'jsonb' })
  asset_snapshot!: Record<string, unknown>;

  @Column({ type: 'varchar', length: 64 })
  asset_snapshot_hash!: string;

  @Column({ type: 'jsonb' })
  pricing_snapshot!: Record<string, unknown>;

  @Column({ type: 'varchar', length: 64 })
  pricing_result_hash!: string;

  @Column({ type: 'jsonb', nullable: true })
  distribution_snapshot!: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  distribution_snapshot_hash!: string | null;

  @Column({ type: 'date' })
  start_date!: string;

  @Column({ type: 'date' })
  end_date!: string;

  @Column({ type: 'varchar', length: 3 })
  currency_code!: string;

  @Column({ type: 'numeric', precision: 20, scale: 4, default: 0 })
  sum_insured!: string;

  @Column({ type: 'numeric', precision: 20, scale: 4, default: 0 })
  premium_excluding_tax!: string;

  @Column({ type: 'numeric', precision: 20, scale: 4, default: 0 })
  premium_including_tax!: string;

  @Column({ type: 'numeric', precision: 20, scale: 4, default: 0 })
  commission_amount!: string;

  @Column({ type: 'numeric', precision: 18, scale: 10, default: 0 })
  commission_rate!: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  final_response_status_code!: string | null;

  @Column({ type: 'text', nullable: true })
  final_response_status_desc!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  final_response_payload!: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  final_response_payload_hash!: string | null;

  @Column({ type: 'boolean', default: false })
  signature_verified!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  issued_at!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  rejected_at!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  expires_at!: Date | null;

  @Column({ type: 'uuid', nullable: true })
  created_by!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at!: Date | null;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company!: Company;

  @ManyToOne(() => Customer, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'customer_id' })
  customer!: Customer;

  @ManyToOne(() => Quotation, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'quotation_id' })
  quotation!: Quotation;

  @ManyToOne(() => QuotationCoverNoteEntry, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'quotation_entry_id' })
  quotation_entry!: QuotationCoverNoteEntry;

  @ManyToOne(() => Policy, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'policy_id' })
  policy!: Policy | null;

  @ManyToOne(() => InsuredAsset, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'insured_asset_id' })
  insured_asset!: InsuredAsset | null;

  @ManyToOne(() => TiramisSubmissionTrackingEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'tiramis_tracking_id' })
  tiramis_tracking!: TiramisSubmissionTrackingEntity;
}
