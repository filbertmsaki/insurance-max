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
import { QuotationEntryRisk } from './quotation-entry-risk.entity';

@Entity('quotation_risk_discounts')
@Index('IDX_qrd_risk_id', ['risk_id'])
@Index('UQ_qrd_risk_sequence', ['risk_id', 'sequence_no'], {
  unique: true,
})
export class QuotationRiskDiscount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  risk_id: string;

  @Column({ type: 'int' })
  sequence_no: number;

  @Column({ type: 'smallint' })
  discount_type: number;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 6,
  })
  discount_rate: string;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
  })
  discount_amount: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => QuotationEntryRisk, (risk) => risk.discounts, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'risk_id' })
  risk: QuotationEntryRisk;
}
