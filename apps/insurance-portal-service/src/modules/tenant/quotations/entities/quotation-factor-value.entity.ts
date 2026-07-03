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
import { RatingFactor } from '../../rating-factors/entities/rating-factor.entity';
import { Quotation } from './quotation.entity';
import { QuotationRisk } from './quotation-risk.entity';

@Entity('quotation_factor_values')
@Index('IDX_qfv_quotation_id', ['quotation_id'])
@Index('IDX_qfv_quotation_risk_id', ['quotation_risk_id'])
@Index('IDX_qfv_factor_id', ['factor_id'])
export class QuotationFactorValue {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  quotation_id: string;

  @Column({ type: 'uuid', nullable: true })
  quotation_risk_id: string | null;

  @Column({ type: 'uuid' })
  factor_id: string;

  @Column({ type: 'text', nullable: true })
  value_text: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 6, nullable: true })
  value_number: string | null;

  @Column({ type: 'date', nullable: true })
  value_date: string | null;

  @Column({ type: 'boolean', nullable: true })
  value_boolean: boolean | null;

  @Column({ type: 'jsonb', nullable: true })
  value_json: Record<string, unknown> | null;

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

  @ManyToOne(() => RatingFactor, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'factor_id' })
  factor: RatingFactor;
}

