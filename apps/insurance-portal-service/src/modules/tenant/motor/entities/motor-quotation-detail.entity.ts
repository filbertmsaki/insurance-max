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
import { MotorVehicle } from './motor-vehicle.entity';
import { Quotation } from '../../quotations/entities/quotation.entity';
import { QuotationRisk } from '../../quotations/entities/quotation-risk.entity';

@Entity('motor_quotation_details')
@Index('IDX_mqd_quotation_id', ['quotation_id'])
@Index('IDX_mqd_quotation_risk_id', ['quotation_risk_id'])
@Index('IDX_mqd_motor_vehicle_id', ['motor_vehicle_id'])
export class MotorQuotationDetail {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  quotation_id: string;

  @Column({ type: 'uuid' })
  quotation_risk_id: string;

  @Column({ type: 'uuid' })
  motor_vehicle_id: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  risk_client_ref: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  cover_type: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  usage_type: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 6, nullable: true })
  no_claim_discount_rate: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 2, nullable: true })
  no_claim_discount_amount: string | null;

  @Column({ type: 'boolean', default: false })
  excess_applicable: boolean;

  @Column({ type: 'varchar', length: 100, nullable: true })
  excess_type: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 6, nullable: true })
  excess_rate: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 2, nullable: true })
  excess_amount: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

  @ManyToOne(() => Quotation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'quotation_id' })
  quotation: Quotation;

  @ManyToOne(() => QuotationRisk, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'quotation_risk_id' })
  quotation_risk: QuotationRisk;

  @ManyToOne(() => MotorVehicle, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'motor_vehicle_id' })
  motor_vehicle: MotorVehicle;
}
