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
import { ProductCalculationBase } from '../enums/product-calculation-base.enum';
import { ProductRuleStatus } from '../enums/product-rule-status.enum';
import { ProductTaxType } from '../enums/product-tax-type.enum';

@Entity('product_tax_rules')
@Index('IDX_ptr_company_id', ['company_id'])
@Index('IDX_ptr_category_id', ['category_id'])
@Index('IDX_ptr_product_id', ['product_id'])
@Index('IDX_ptr_risk_id', ['risk_id'])
@Index('IDX_ptr_status', ['status'])
export class ProductTaxRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid', nullable: true })
  category_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  product_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  risk_id: string | null;

  @Column({ length: 150 })
  tax_name: string;

  @Column({ length: 50 })
  tax_code: string;

  @Column({
    type: 'enum',
    enum: ProductTaxType,
    enumName: 'product_tax_type_enum',
  })
  tax_type: ProductTaxType;

  @Column({ type: 'numeric', precision: 18, scale: 6, nullable: true })
  tax_rate: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 2, nullable: true })
  tax_amount: string | null;

  @Column({
    type: 'enum',
    enum: ProductCalculationBase,
    enumName: 'product_calculation_base_enum',
    default: ProductCalculationBase.BASIC_PREMIUM,
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

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @ManyToOne(() => InsuranceCategory, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'category_id' })
  category: InsuranceCategory | null;

  @ManyToOne(() => InsuranceProduct, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: InsuranceProduct | null;

  @ManyToOne(() => InsuranceRisk, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'risk_id' })
  risk: InsuranceRisk | null;
}
