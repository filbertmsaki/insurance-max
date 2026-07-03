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
import { SubjectMatter } from '../../non-motor/entities/subject-matter.entity';
import { MotorVehicle } from '../../motor/entities/motor-vehicle.entity';
import { Quotation } from './quotation.entity';

@Entity('quotation_risks')
@Index('IDX_quotation_risks_quotation_id', ['quotation_id'])
@Index('IDX_quotation_risks_risk_id', ['risk_id'])
export class QuotationRisk {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  quotation_id: string;

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
  fixed_amount: string;

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

  @Column({ type: 'uuid', nullable: true })
  rating_rule_id: string | null;

  @Column({ type: 'jsonb', nullable: true })
  rating_result_metadata: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

  @ManyToOne(() => Quotation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'quotation_id' })
  quotation: Quotation;

  @ManyToOne(() => InsuranceRisk, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'risk_id' })
  risk: InsuranceRisk;

  @ManyToOne(() => SubjectMatter, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'subject_matter_id' })
  subject_matter: SubjectMatter | null;

  @ManyToOne(() => MotorVehicle, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'motor_vehicle_id' })
  motor_vehicle: MotorVehicle | null;
}
