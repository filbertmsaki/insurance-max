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
import { RateType } from '@insurance-max/portal-shared/enums/rate-type.enum';
import { Company } from '../../../platform/companies/entities/company.entity';
import { InsuranceRisk } from '../../insurance-risks/entities/insurance-risk.entity';
import { PricingRateBook } from '../../pricing-rate-books/entities/pricing-rate-book.entity';

@Entity('risk_rating_rules')
@Index('IDX_risk_rating_rules_company_id', ['company_id'])
@Index('IDX_risk_rating_rules_risk_id', ['risk_id'])
@Index('IDX_risk_rating_rules_is_active', ['is_active'])
@Index(
  'UQ_risk_rating_rules_company_risk_name_legacy',
  ['company_id', 'risk_id', 'rule_name'],
  {
    unique: true,
    where: `"rate_book_id" IS NULL AND "deleted_at" IS NULL`,
  },
)
@Index(
  'UQ_risk_rating_rules_company_risk_book_name',
  ['company_id', 'risk_id', 'rate_book_id', 'rule_name'],
  {
    unique: true,
    where: `"rate_book_id" IS NOT NULL AND "deleted_at" IS NULL`,
  },
)
export class RiskRatingRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  company_id: string;

  @Column({ type: 'varchar' })
  risk_id: string;

  @Column({ type: 'uuid', nullable: true })
  rate_book_id: string | null;

  @Column({ length: 150 })
  rule_name: string;

  @Column({
    type: 'varchar',
    enum: RateType,
    default: RateType.PERCENTAGE,
  })
  rate_type: RateType;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 10,
    nullable: true,
    comment: 'Rate as a decimal fraction (e.g. 0.035 means 3.5%)',
  })
  percentage_rate: number | null;

  @Column({ type: 'numeric', precision: 20, scale: 4, nullable: true })
  fixed_amount: number | null;

  @Column({ type: 'numeric', precision: 20, scale: 4, nullable: true })
  per_unit_amount: number | null;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    comment: 'Factor code used as unit for per-unit rate types',
  })
  per_unit_factor_code: string | null;

  @Column({ type: 'numeric', precision: 20, scale: 4, nullable: true })
  minimum_amount: number | null;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 10,
    nullable: true,
    comment: 'Maximum aggregate discount rate allowed as a decimal fraction',
  })
  max_discount_rate: number | null;

  @Column({ type: 'numeric', precision: 20, scale: 4, nullable: true })
  max_discount_amount: number | null;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 10,
    nullable: true,
    comment:
      'Approval threshold for discount rate as a decimal fraction; requests above this require approval',
  })
  discount_approval_threshold_rate: number | null;

  @Column({ type: 'numeric', precision: 20, scale: 4, nullable: true })
  discount_approval_threshold_amount: number | null;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 10,
    nullable: true,
    comment: 'Maximum aggregate loading rate allowed as a decimal fraction',
  })
  max_loading_rate: number | null;

  @Column({ type: 'numeric', precision: 20, scale: 4, nullable: true })
  max_loading_amount: number | null;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 10,
    nullable: true,
    comment:
      'Approval threshold for loading rate as a decimal fraction; requests above this require approval',
  })
  loading_approval_threshold_rate: number | null;

  @Column({ type: 'numeric', precision: 20, scale: 4, nullable: true })
  loading_approval_threshold_amount: number | null;

  @Column({ type: 'date', nullable: true })
  adjustment_effective_from: string | null;

  @Column({ type: 'date', nullable: true })
  adjustment_effective_to: string | null;

  @Column({
    type: 'text',
    nullable: true,
    comment:
      'Legacy structured shorthand text used only for migration into supported calculator strategies',
  })
  formula: string | null;

  @Column({ type: 'int', default: 1 })
  priority: number;

  @Column({ type: 'int', default: 1 })
  rule_version: number;

  @Column({ default: true })
  is_active: boolean;

  @Column({ type: 'varchar', nullable: true })
  created_by: string | null;

  @Column({ type: 'varchar', nullable: true })
  updated_by: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @DeleteDateColumn({ type: 'timestamp', nullable: true })
  deleted_at: Date | null;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @ManyToOne(() => InsuranceRisk, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'risk_id' })
  risk: InsuranceRisk;

  @ManyToOne(() => PricingRateBook, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'rate_book_id' })
  rate_book: PricingRateBook | null;

  @OneToMany('RiskRuleCondition', 'rule')
  conditions: any[];
}
