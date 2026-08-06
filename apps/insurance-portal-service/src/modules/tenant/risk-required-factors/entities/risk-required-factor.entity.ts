import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Company } from '../../../platform/companies/entities/company.entity';
import { InsuranceRisk } from '../../insurance-risks/entities/insurance-risk.entity';
import { RatingFactor } from '../../rating-factors/entities/rating-factor.entity';
import { PricingRateBook } from '../../pricing-rate-books/entities/pricing-rate-book.entity';

@Entity('risk_required_factors')
@Index(
  'UQ_required_factor_rate_book',
  ['company_id', 'rate_book_id', 'risk_id', 'factor_id'],
  { unique: true, where: `"rate_book_id" IS NOT NULL` },
)
@Index(
  'UQ_required_factor_legacy',
  ['company_id', 'risk_id', 'factor_id'],
  { unique: true, where: `"rate_book_id" IS NULL` },
)
@Index('IDX_risk_required_factors_company_id', ['company_id'])
@Index('IDX_risk_required_factors_risk_id', ['risk_id'])
@Index('IDX_risk_required_factors_factor_id', ['factor_id'])
export class RiskRequiredFactor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  company_id: string;

  @Column({ type: 'varchar' })
  risk_id: string;

  @Column({ type: 'varchar' })
  factor_id: string;

  @Column({ default: true })
  is_required: boolean;

  @Column({ type: 'int', default: 0 })
  sort_order: number;

  @Column({ type: 'uuid', nullable: true })
  rate_book_id: string | null;

  @Column({ type: 'jsonb', nullable: true })
  factor_snapshot: Record<string, unknown> | null;

  @Column({ type: 'varchar', nullable: true })
  created_by: string | null;

  @Column({ type: 'varchar', nullable: true })
  updated_by: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @ManyToOne(() => InsuranceRisk, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'risk_id' })
  risk: InsuranceRisk;

  @ManyToOne(() => RatingFactor, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'factor_id' })
  factor: RatingFactor;

  @ManyToOne(() => PricingRateBook, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'rate_book_id' })
  rate_book: PricingRateBook | null;
}
