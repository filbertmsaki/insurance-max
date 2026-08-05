import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import {
  ProductReviewStatus,
  ProductVersionStatus,
} from '@insurance-max/contracts';
import { Company } from '../../../platform/companies/entities/company.entity';
import { InsuranceBusinessLine } from '../../insurance-categories/enums/insurance-business-line.enum';
import { InsuranceProduct } from './insurance-product.entity';
import { ProductDefinitionItem } from './product-definition-item.entity';
import { ProductAddonDefinition } from './product-addon-definition.entity';
import { ProductDocumentRequirement } from './product-document-requirement.entity';
import { ProductVersionSubClass } from './product-version-sub-class.entity';

@Entity('insurance_product_versions')
@Unique('UQ_insurance_product_version_number', ['product_id', 'version_number'])
@Index('IDX_product_versions_company', ['company_id'])
@Index('IDX_product_versions_product_status', [
  'product_id',
  'status',
  'effective_from',
  'effective_to',
])
export class InsuranceProductVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid' })
  product_id: string;

  @Column({ type: 'integer' })
  version_number: number;

  @Column({
    type: 'varchar',
    length: 30,
    default: ProductVersionStatus.DRAFT,
  })
  status: ProductVersionStatus;

  @Column({
    type: 'varchar',
    length: 30,
    default: ProductReviewStatus.DRAFT,
  })
  review_status: ProductReviewStatus;

  @Column({ type: 'varchar', length: 150 })
  product_name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    type: 'enum',
    enum: InsuranceBusinessLine,
    enumName: 'insurance_business_line_enum',
  })
  business_line: InsuranceBusinessLine;

  @Column({ default: false })
  supports_fleet: boolean;

  @Column({ type: 'varchar', length: 50, nullable: true })
  tiramis_product_code: string | null;

  @Column({ type: 'integer', default: 1 })
  cover_note_type: number;

  @Column({ type: 'integer', default: 365 })
  default_cover_duration_days: number;

  @Column({ type: 'varchar', length: 3, default: 'TZS' })
  currency_code: string;

  @Column({ type: 'text', nullable: true })
  cover_note_description: string | null;

  @Column({ type: 'text', nullable: true })
  operative_clause: string | null;

  @Column({ type: 'text', nullable: true })
  policy_operative_clause: string | null;

  @Column({ type: 'text', nullable: true })
  special_conditions: string | null;

  @Column({ type: 'text', nullable: true })
  exclusions: string | null;

  @Column({ default: false })
  allows_cover_text_override: boolean;

  @Column({ type: 'date', nullable: true })
  effective_from: string | null;

  @Column({ type: 'date', nullable: true })
  effective_to: string | null;

  @Column({ default: false })
  is_submission_ready: boolean;

  @Column({ type: 'varchar', length: 64, nullable: true })
  definition_hash: string | null;

  @Column({ type: 'text', nullable: true })
  review_comments: string | null;

  @Column({ type: 'uuid', nullable: true })
  submitted_for_review_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  submitted_for_review_at: Date | null;

  @Column({ type: 'uuid', nullable: true })
  reviewed_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  reviewed_at: Date | null;

  @Column({ type: 'uuid', nullable: true })
  published_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  published_at: Date | null;

  @Column({ type: 'uuid', nullable: true })
  retired_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  retired_at: Date | null;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @Column({ type: 'uuid', nullable: true })
  updated_by: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @ManyToOne(() => InsuranceProduct, (product) => product.versions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'product_id' })
  product: InsuranceProduct;

  @OneToMany(() => ProductDefinitionItem, (item) => item.product_version, {
    cascade: true,
  })
  definition_items: ProductDefinitionItem[];

  @OneToMany(() => ProductAddonDefinition, (addon) => addon.product_version, {
    cascade: true,
  })
  addons: ProductAddonDefinition[];

  @OneToMany(
    () => ProductDocumentRequirement,
    (requirement) => requirement.product_version,
    { cascade: true },
  )
  document_requirements: ProductDocumentRequirement[];

  @OneToMany(
    () => ProductVersionSubClass,
    (assignment) => assignment.product_version,
    { cascade: true },
  )
  sub_classes: ProductVersionSubClass[];
}
