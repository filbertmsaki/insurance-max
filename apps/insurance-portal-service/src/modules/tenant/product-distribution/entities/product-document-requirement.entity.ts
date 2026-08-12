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
import { InsuranceProduct } from '../../insurance-products/entities/insurance-product.entity';
import { InsuranceRisk } from '../../insurance-risks/entities/insurance-risk.entity';
import { ProductRuleStatus } from '../enums/product-rule-status.enum';

@Entity('product_distribution_document_requirements')
@Index('IDX_pddr_company_id', ['company_id'])
@Index('IDX_pddr_product_id', ['product_id'])
@Index('IDX_pddr_risk_id', ['risk_id'])
@Index('IDX_pddr_status', ['status'])
export class ProductDocumentRequirement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid' })
  product_id: string;

  @Column({ type: 'uuid', nullable: true })
  risk_id: string | null;

  @Column({ length: 80 })
  document_type: string;

  @Column({ length: 150 })
  document_name: string;

  @Column({ default: false })
  is_required: boolean;

  @Column({ default: false })
  is_required_before_quote: boolean;

  @Column({ default: false })
  is_required_before_policy: boolean;

  @Column({ default: false })
  is_required_before_claim: boolean;

  @Column({
    type: 'varchar',
    length: 20,
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

  @ManyToOne(() => InsuranceProduct, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: InsuranceProduct;

  @ManyToOne(() => InsuranceRisk, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'risk_id' })
  risk: InsuranceRisk | null;
}
