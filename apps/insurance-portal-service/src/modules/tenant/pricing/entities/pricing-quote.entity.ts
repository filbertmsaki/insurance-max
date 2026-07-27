import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Company } from '../../../platform/companies/entities/company.entity';
import { InsuranceProduct } from '../../insurance-products/entities/insurance-product.entity';
import { InsuranceRisk } from '../../insurance-risks/entities/insurance-risk.entity';

export enum PricingQuoteScope {
  SINGLE_RISK = 'SINGLE_RISK',
  MULTI_RISK = 'MULTI_RISK',
}

export enum PricingQuoteStatus {
  CALCULATED = 'CALCULATED',
}

@Entity('pricing_quotes')
@Index('IDX_pricing_quotes_company_id', ['company_id'])
@Index('IDX_pricing_quotes_company_product_id', ['company_id', 'product_id'])
@Index('IDX_pricing_quotes_company_risk_id', ['company_id', 'risk_id'])
@Index('IDX_pricing_quotes_pricing_quote_id', ['pricing_quote_id'], {
  unique: true,
})
export class PricingQuote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'varchar', length: 30 })
  pricing_quote_id: string;

  @Column({ type: 'bigint', unique: true })
  sequence_no: string;

  @Column({
    type: 'varchar',
    enum: PricingQuoteScope,
  })
  quote_scope: PricingQuoteScope;

  @Column({
    type: 'varchar',
    enum: PricingQuoteStatus,
    default: PricingQuoteStatus.CALCULATED,
  })
  calculation_status: PricingQuoteStatus;

  @Column({ type: 'uuid', nullable: true })
  calculated_by: string | null;

  @Column({ type: 'uuid', nullable: true })
  product_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  risk_id: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  quotation_type: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  currency_code: string | null;

  @Column({ type: 'uuid', nullable: true })
  rate_book_id: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  rate_book_version: string | null;

  @Column({ type: 'uuid', nullable: true })
  matched_rule_id: string | null;

  @Column({ type: 'int', nullable: true })
  matched_rule_version: number | null;

  @Column({ type: 'numeric', precision: 20, scale: 4, default: 0 })
  base_premium: number;

  @Column({ type: 'numeric', precision: 20, scale: 4, default: 0 })
  minimum_premium_adjustment: number;

  @Column({ type: 'numeric', precision: 20, scale: 4, default: 0 })
  gross_premium: number;

  @Column({ type: 'numeric', precision: 20, scale: 4, default: 0 })
  final_premium: number;

  @Column({ type: 'timestamptz' })
  expires_at: Date;

  @Column({ type: 'timestamptz' })
  calculated_at: Date;

  @Column({ type: 'varchar', length: 64 })
  input_signature: string;

  @Column({ type: 'jsonb' })
  input_payload: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  factor_payload: Record<string, unknown> | null;

  @Column({ type: 'jsonb' })
  result_payload: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  warning_messages: string[] | null;

  @Column({ type: 'jsonb', nullable: true })
  context_payload: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @ManyToOne(() => InsuranceProduct, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'product_id' })
  product: InsuranceProduct | null;

  @ManyToOne(() => InsuranceRisk, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'risk_id' })
  risk: InsuranceRisk | null;
}
