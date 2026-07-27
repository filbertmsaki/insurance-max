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
    scale: 10,
  })
  discount_rate: string;

  @Column({
    type: 'numeric',
    precision: 20,
    scale: 4,
  })
  discount_amount: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  request_reason_code: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  request_comment: string | null;

  @Column({ type: 'date', nullable: true })
  effective_from: string | null;

  @Column({ type: 'date', nullable: true })
  effective_to: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  requested_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  requested_at: Date | null;

  @Column({ type: 'numeric', precision: 18, scale: 10, nullable: true })
  max_permitted_rate: string | null;

  @Column({ type: 'numeric', precision: 20, scale: 4, nullable: true })
  max_permitted_amount: string | null;

  @Column({ type: 'boolean', default: false })
  approval_required: boolean;

  @Column({ type: 'varchar', length: 20, default: 'NOT_REQUIRED' })
  approval_status: string;

  @Column({ type: 'numeric', precision: 18, scale: 10, nullable: true })
  approved_rate: string | null;

  @Column({ type: 'numeric', precision: 20, scale: 4, nullable: true })
  approved_amount: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  approved_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  approval_date: Date | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  rejection_reason: string | null;

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
