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
import { InsuranceSubClass } from '../../insurance-sub-classes/entities/insurance-sub-class.entity';
import { ProductChannelType } from '../enums/product-channel-type.enum';
import { ProductRuleStatus } from '../enums/product-rule-status.enum';

@Entity('product_distribution_channels')
@Index('IDX_pdc_insurer_company_id', ['insurer_company_id'])
@Index('IDX_pdc_intermediary_company_id', ['intermediary_company_id'])
@Index('IDX_pdc_product_id', ['product_id'])
@Index('IDX_pdc_status', ['status'])
@Index('IDX_pdc_channel_type', ['channel_type'])
export class ProductDistributionChannel {
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
  sub_class_id: string | null;

  @Column({
    type: 'varchar',
    length: 20,
  })
  channel_type: ProductChannelType;

  @Column({ default: false })
  can_quote: boolean;

  @Column({ default: false })
  can_bind: boolean;

  @Column({ default: false })
  can_issue_policy: boolean;

  @Column({ default: false })
  can_collect_premium: boolean;

  @Column({ default: false })
  requires_underwriting: boolean;

  @Column({ default: false })
  requires_insurer_approval: boolean;

  @Column({ type: 'date' })
  effective_from: string;

  @Column({ type: 'date' })
  effective_to: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: ProductRuleStatus.ACTIVE,
  })
  status: ProductRuleStatus;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

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

  @ManyToOne(() => InsuranceSubClass, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sub_class_id' })
  sub_class: InsuranceSubClass | null;
}
