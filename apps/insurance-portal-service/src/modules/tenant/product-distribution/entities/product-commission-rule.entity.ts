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
import { Company } from '../../../platform/companies/entities/company.entity';
import { InsuranceCategory } from '../../insurance-categories/entities/insurance-category.entity';
import { InsuranceProduct } from '../../insurance-products/entities/insurance-product.entity';
import { InsuranceRisk } from '../../insurance-risks/entities/insurance-risk.entity';
import { ProductChannelType } from '../enums/product-channel-type.enum';
import { ProductCalculationBase } from '../enums/product-calculation-base.enum';
import { ProductCommissionType } from '../enums/product-commission-type.enum';
import { ProductRuleStatus } from '../enums/product-rule-status.enum';

@Entity('product_commission_rules')
@Index('IDX_pcr_insurer_company_id', ['insurer_company_id'])
@Index('IDX_pcr_intermediary_company_id', ['intermediary_company_id'])
@Index('IDX_pcr_product_id', ['product_id'])
@Index('IDX_pcr_risk_id', ['risk_id'])
@Index('IDX_pcr_status', ['status'])
export class ProductCommissionRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  insurer_company_id: string;

  @Column({ type: 'uuid', nullable: true })
  intermediary_company_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  category_id: string | null;

  @Column({ type: 'uuid' })
  product_id: string;

  @Column({ type: 'uuid', nullable: true })
  risk_id: string | null;

  @Column({
    type: 'enum',
    enum: ProductChannelType,
    enumName: 'product_channel_type_enum',
  })
  channel_type: ProductChannelType;

  @Column({
    type: 'enum',
    enum: ProductCommissionType,
    enumName: 'product_commission_type_enum',
  })
  commission_type: ProductCommissionType;

  @Column({ type: 'numeric', precision: 18, scale: 10, nullable: true })
  commission_rate: string | null;

  @Column({ type: 'numeric', precision: 20, scale: 4, nullable: true })
  commission_amount: string | null;

  @Column({ type: 'numeric', precision: 20, scale: 4, nullable: true })
  minimum_commission: string | null;

  @Column({ type: 'numeric', precision: 20, scale: 4, nullable: true })
  maximum_commission: string | null;

  @Column({
    type: 'enum',
    enum: ProductCalculationBase,
    enumName: 'product_calculation_base_enum',
    default: ProductCalculationBase.GROSS_PREMIUM,
  })
  calculation_base: ProductCalculationBase;

  @Column({ type: 'date' })
  effective_from: string;

  @Column({ type: 'date' })
  effective_to: string;

  @Column({
    type: 'enum',
    enum: ProductRuleStatus,
    enumName: 'product_rule_status_enum',
    default: ProductRuleStatus.ACTIVE,
  })
  status: ProductRuleStatus;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'insurer_company_id' })
  insurer_company: Company;

  @ManyToOne(() => Company, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'intermediary_company_id' })
  intermediary_company: Company | null;

  @ManyToOne(() => InsuranceCategory, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'category_id' })
  category: InsuranceCategory | null;

  @ManyToOne(() => InsuranceProduct, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: InsuranceProduct;

  @ManyToOne(() => InsuranceRisk, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'risk_id' })
  risk: InsuranceRisk | null;
}
