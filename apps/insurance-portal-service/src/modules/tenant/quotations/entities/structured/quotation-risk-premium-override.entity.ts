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
import { User } from '../../../users/entities/user.entity';
import { QuotationPremiumOverrideStatus } from '../../enums/quotation-premium-override-status.enum';
import { QuotationEntryRisk } from './quotation-entry-risk.entity';

@Entity('quotation_risk_premium_overrides')
@Index('IDX_qrpo_risk_id', ['risk_id'])
@Index('UQ_qrpo_risk_sequence', ['risk_id', 'sequence_no'], { unique: true })
export class QuotationRiskPremiumOverride {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  risk_id: string;

  @Column({ type: 'int' })
  sequence_no: number;

  @Column({
    type: 'numeric',
    precision: 20,
    scale: 4,
  })
  original_calculated_premium: string;

  @Column({
    type: 'numeric',
    precision: 20,
    scale: 4,
  })
  proposed_premium: string;

  @Column({
    type: 'numeric',
    precision: 20,
    scale: 4,
  })
  difference_amount: string;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 10,
    nullable: true,
  })
  difference_percentage: string | null;

  @Column({ type: 'varchar', length: 150 })
  override_reason: string;

  @Column({ type: 'text', nullable: true })
  supporting_notes: string | null;

  @Column({ type: 'uuid', nullable: true })
  requested_by: string | null;

  @Column({ type: 'timestamptz' })
  requested_at: Date;

  @Column({
    type: 'varchar',
    length: 20,
    default: QuotationPremiumOverrideStatus.PENDING,
  })
  approval_status: QuotationPremiumOverrideStatus;

  @Column({ type: 'uuid', nullable: true })
  approved_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  approved_at: Date | null;

  @Column({ type: 'text', nullable: true })
  rejection_reason: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => QuotationEntryRisk, (risk) => risk.premium_overrides, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'risk_id' })
  risk: QuotationEntryRisk;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'requested_by' })
  requester: User | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'approved_by' })
  approver: User | null;
}
