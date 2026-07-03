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
import { QuotationCalculationBase } from '../../quotations/enums/quotation-calculation-base.enum';
import { QuotationPremiumItemType } from '../../quotations/enums/quotation-premium-item-type.enum';
import { Policy } from './policy.entity';
import { PolicyRisk } from './policy-risk.entity';

@Entity('policy_premium_breakdowns')
@Index('IDX_ppb_policy_id', ['policy_id'])
@Index('IDX_ppb_policy_risk_id', ['policy_risk_id'])
export class PolicyPremiumBreakdown {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  policy_id: string;

  @Column({ type: 'uuid', nullable: true })
  policy_risk_id: string | null;

  @Column({
    type: 'enum',
    enum: QuotationPremiumItemType,
    enumName: 'policy_premium_item_type_enum',
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
    enumName: 'policy_calculation_base_enum',
    default: QuotationCalculationBase.BASIC_PREMIUM,
  })
  calculation_base: QuotationCalculationBase;

  @Column({ type: 'int', default: 0 })
  calculation_order: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => Policy, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'policy_id' })
  policy: Policy;

  @ManyToOne(() => PolicyRisk, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'policy_risk_id' })
  policy_risk: PolicyRisk | null;
}
