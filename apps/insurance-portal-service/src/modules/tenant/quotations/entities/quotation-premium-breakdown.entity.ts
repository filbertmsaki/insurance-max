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
import { QuotationCalculationBase } from '../enums/quotation-calculation-base.enum';
import { QuotationPremiumItemType } from '../enums/quotation-premium-item-type.enum';
import { Quotation } from './quotation.entity';
import { QuotationRisk } from './quotation-risk.entity';

@Entity('quotation_premium_breakdowns')
@Index('IDX_qpb_quotation_id', ['quotation_id'])
@Index('IDX_qpb_quotation_risk_id', ['quotation_risk_id'])
export class QuotationPremiumBreakdown {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  quotation_id: string;

  @Column({ type: 'uuid', nullable: true })
  quotation_risk_id: string | null;

  @Column({
    type: 'enum',
    enum: QuotationPremiumItemType,
    enumName: 'quotation_premium_item_type_enum',
  })
  item_type: QuotationPremiumItemType;

  @Column({ type: 'varchar', length: 50 })
  item_code: string;

  @Column({ type: 'varchar', length: 150 })
  item_name: string;

  @Column({ type: 'numeric', precision: 18, scale: 6, default: 0 })
  rate: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  amount: string;

  @Column({
    type: 'enum',
    enum: QuotationCalculationBase,
    enumName: 'quotation_calculation_base_enum',
    default: QuotationCalculationBase.BASIC_PREMIUM,
  })
  calculation_base: QuotationCalculationBase;

  @Column({ type: 'int', default: 0 })
  calculation_order: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => Quotation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'quotation_id' })
  quotation: Quotation;

  @ManyToOne(() => QuotationRisk, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'quotation_risk_id' })
  quotation_risk: QuotationRisk | null;
}
