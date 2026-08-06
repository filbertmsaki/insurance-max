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
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import {
  PricingProrationMethod,
  PricingRoundingMode,
} from '@insurance-max/contracts';
import { Company } from '../../../platform/companies/entities/company.entity';
import { InsuranceProduct } from '../../insurance-products/entities/insurance-product.entity';
import { InsuranceProductVersion } from '../../insurance-products/entities/insurance-product-version.entity';
import { PricingRateBookStatus } from '../enums/pricing-rate-book-status.enum';

@Entity('pricing_rate_books')
@Unique('UQ_pricing_rate_books_company_code_version', [
  'company_id',
  'code',
  'version',
])
@Index('IDX_pricing_rate_books_company_product', ['company_id', 'product_id'])
@Index('IDX_pricing_rate_books_status', ['status'])
export class PricingRateBook {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  company_id: string;

  @Column({ type: 'varchar' })
  product_id: string;

  @Column({ type: 'varchar', length: 50 })
  code: string;

  @Column({ type: 'varchar', length: 30 })
  version: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  name: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  currency_code: string | null;

  @Column({
    type: 'varchar',
    enum: PricingRateBookStatus,
    default: PricingRateBookStatus.DRAFT,
  })
  status: PricingRateBookStatus;

  @Column({ type: 'date' })
  effective_from: string;

  @Column({ type: 'date', nullable: true })
  effective_to: string | null;

  @Column({ type: 'uuid', nullable: true })
  product_version_id: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  product_definition_hash: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  definition_hash: string | null;

  @Column({ type: 'varchar', length: 30, default: '7.1' })
  calculation_version: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: PricingRoundingMode.HALF_UP,
  })
  rounding_mode: PricingRoundingMode;

  @Column({ type: 'numeric', precision: 20, scale: 4, default: 1 })
  rounding_increment: string;

  @Column({
    type: 'varchar',
    length: 30,
    default: PricingProrationMethod.NONE,
  })
  proration_method: PricingProrationMethod;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ type: 'varchar', nullable: true })
  created_by: string | null;

  @Column({ type: 'varchar', nullable: true })
  reviewed_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  reviewed_at: Date | null;

  @Column({ type: 'varchar', nullable: true })
  approved_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  approved_at: Date | null;

  @Column({ type: 'varchar', nullable: true })
  published_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  published_at: Date | null;

  @Column({ type: 'varchar', nullable: true })
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

  @ManyToOne(() => InsuranceProduct, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: InsuranceProduct;

  @ManyToOne(() => InsuranceProductVersion, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'product_version_id' })
  product_version: InsuranceProductVersion | null;

  @OneToMany('RiskRatingRule', 'rate_book')
  rules: any[];
}
