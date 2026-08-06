import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { AddonPricingType } from '@insurance-max/contracts';
import { Company } from '../../../platform/companies/entities/company.entity';
import { InsuranceProductVersion } from '../../insurance-products/entities/insurance-product-version.entity';
import { ProductAddonDefinition } from '../../insurance-products/entities/product-addon-definition.entity';
import { PricingRateBook } from '../../pricing-rate-books/entities/pricing-rate-book.entity';

@Entity('product_addon_rate_rules')
@Unique('UQ_addon_rate_rule_code', ['rate_book_id', 'rule_code'])
@Index('IDX_addon_rate_rules_resolution', [
  'company_id',
  'rate_book_id',
  'addon_definition_id',
  'is_active',
  'priority',
])
export class ProductAddonRateRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid' })
  rate_book_id: string;

  @Column({ type: 'uuid' })
  product_version_id: string;

  @Column({ type: 'uuid' })
  addon_definition_id: string;

  @Column({ type: 'varchar', length: 50 })
  rule_code: string;

  @Column({ type: 'varchar', length: 30 })
  pricing_type: AddonPricingType;

  @Column({ type: 'numeric', precision: 18, scale: 10, nullable: true })
  percentage_rate: string | null;

  @Column({ type: 'numeric', precision: 20, scale: 4, nullable: true })
  fixed_amount: string | null;

  @Column({ type: 'numeric', precision: 20, scale: 4, nullable: true })
  per_unit_amount: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  per_unit_factor_code: string | null;

  @Column({ type: 'numeric', precision: 20, scale: 4, nullable: true })
  minimum_amount: string | null;

  @Column({ type: 'numeric', precision: 20, scale: 4, nullable: true })
  maximum_amount: string | null;

  @Column({ type: 'date', nullable: true })
  effective_from: string | null;

  @Column({ type: 'date', nullable: true })
  effective_to: string | null;

  @Column({ type: 'int', default: 100 })
  priority: number;

  @Column({ default: true })
  is_active: boolean;

  @Column({ type: 'jsonb' })
  addon_snapshot: Record<string, unknown>;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @Column({ type: 'uuid', nullable: true })
  updated_by: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @ManyToOne(() => PricingRateBook, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'rate_book_id' })
  rate_book: PricingRateBook;

  @ManyToOne(() => InsuranceProductVersion, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_version_id' })
  product_version: InsuranceProductVersion;

  @ManyToOne(() => ProductAddonDefinition, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'addon_definition_id' })
  addon_definition: ProductAddonDefinition;
}
