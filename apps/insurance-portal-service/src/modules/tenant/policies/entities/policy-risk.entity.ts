import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { InsuranceRisk } from '../../insurance-risks/entities/insurance-risk.entity';
import { QuotationEntryRisk } from '../../quotations/entities/structured/quotation-entry-risk.entity';
import { SubjectMatter } from '../../non-motor/entities/subject-matter.entity';
import { MotorVehicle } from '../../motor/entities/motor-vehicle.entity';
import { Policy } from './policy.entity';

@Entity('policy_risks')
@Index('IDX_policy_risks_policy_id', ['policy_id'])
@Index('IDX_policy_risks_risk_id', ['risk_id'])
export class PolicyRisk {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  policy_id: string;

  @Column({ type: 'uuid', nullable: true })
  quotation_entry_risk_id: string | null;

  @Column({ type: 'uuid' })
  risk_id: string;

  @Column({ type: 'uuid', nullable: true })
  subject_matter_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  motor_vehicle_id: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  sum_insured: string;

  @Column({ type: 'numeric', precision: 18, scale: 6, default: 0 })
  rate: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  basic_premium: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  discount_amount: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  tax_amount: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  charges_amount: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  commission_amount: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  total_premium: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  net_premium: string;

  @Column({ type: 'boolean', default: false })
  reinsurance_required: boolean;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  retention_amount: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  ceded_sum_insured: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  ceded_premium: string;

  @Column({ type: 'varchar', length: 20, default: 'NOT_REQUIRED' })
  reinsurance_status: string;

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status: string;

  /** Off cover from this date (a vehicle removed from a fleet mid-term). */
  @Column({ type: 'date', nullable: true })
  cancelled_at: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

  @ManyToOne(() => Policy, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'policy_id' })
  policy: Policy;

  @ManyToOne(() => InsuranceRisk, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'risk_id' })
  risk: InsuranceRisk;

  @ManyToOne(() => QuotationEntryRisk, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'quotation_entry_risk_id' })
  quotation_entry_risk: QuotationEntryRisk | null;

  @ManyToOne(() => SubjectMatter, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'subject_matter_id' })
  subject_matter: SubjectMatter | null;

  @ManyToOne(() => MotorVehicle, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'motor_vehicle_id' })
  motor_vehicle: MotorVehicle | null;
}
