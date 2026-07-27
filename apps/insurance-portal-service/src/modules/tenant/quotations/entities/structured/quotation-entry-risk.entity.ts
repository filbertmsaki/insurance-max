import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { InsuranceRisk } from '../../../insurance-risks/entities/insurance-risk.entity';
import { QuotationRiskDiscount } from './quotation-risk-discount.entity';
import { QuotationRiskPremiumOverride } from './quotation-risk-premium-override.entity';
import { QuotationRiskTax } from './quotation-risk-tax.entity';
import { QuotationCoverNoteEntry } from './quotation-cover-note-entry.entity';

@Entity('quotation_entry_risks')
@Index('UQ_qer_entry_sequence', ['entry_id', 'sequence_no'], {
  unique: true,
})
@Index('IDX_qer_entry_id', ['entry_id'])
@Index('IDX_qer_risk_code', ['risk_code'])
@Index('IDX_qer_insurance_risk_id', ['insurance_risk_id'])
export class QuotationEntryRisk {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  entry_id: string;

  /**
   * Optional connection to the configured product risk.
   *
   * The risk_code snapshot is retained separately so historical
   * quotation data remains valid if the master risk changes.
   */
  @Column({
    type: 'uuid',
    nullable: true,
  })
  insurance_risk_id: string | null;

  @Column({ type: 'int' })
  sequence_no: number;

  @Column({
    type: 'varchar',
    length: 50,
  })
  risk_code: string;

  @Column({
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  pricing_quote_id: string | null;

  @Column({
    type: 'numeric',
    precision: 20,
    scale: 4,
  })
  sum_insured: string;

  @Column({
    type: 'numeric',
    precision: 20,
    scale: 4,
  })
  sum_insured_equivalent: string;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 10,
  })
  premium_rate: string;

  @Column({
    type: 'numeric',
    precision: 20,
    scale: 4,
  })
  premium_before_discount: string;

  @Column({
    type: 'numeric',
    precision: 20,
    scale: 4,
  })
  premium_after_discount: string;

  @Column({
    type: 'numeric',
    precision: 20,
    scale: 4,
  })
  premium_excluding_tax_equivalent: string;

  @Column({
    type: 'numeric',
    precision: 20,
    scale: 4,
  })
  premium_including_tax: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => QuotationCoverNoteEntry, (entry) => entry.risks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'entry_id' })
  entry: QuotationCoverNoteEntry;

  @ManyToOne(() => InsuranceRisk, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'insurance_risk_id' })
  insurance_risk: InsuranceRisk | null;

  @OneToMany(() => QuotationRiskDiscount, (discount) => discount.risk)
  discounts: QuotationRiskDiscount[];

  @OneToMany(
    () => QuotationRiskPremiumOverride,
    (premiumOverride) => premiumOverride.risk,
  )
  premium_overrides: QuotationRiskPremiumOverride[];

  @OneToMany(() => QuotationRiskTax, (tax) => tax.risk)
  taxes: QuotationRiskTax[];
}
