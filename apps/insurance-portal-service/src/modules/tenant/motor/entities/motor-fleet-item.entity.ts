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
import { QuotationEntryRisk } from '../../quotations/entities/structured/quotation-entry-risk.entity';
import { MotorFleet } from './motor-fleet.entity';
import { MotorVehicle } from './motor-vehicle.entity';

@Entity('motor_fleet_items')
@Index('IDX_mfi_fleet_id', ['fleet_id'])
@Index('IDX_mfi_motor_vehicle_id', ['motor_vehicle_id'])
@Index('IDX_mfi_quotation_entry_risk_id', ['quotation_entry_risk_id'])
export class MotorFleetItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  fleet_id: string;

  @Column({ type: 'uuid' })
  motor_vehicle_id: string;

  @Column({ type: 'uuid', nullable: true })
  quotation_entry_risk_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  policy_risk_id: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  risk_client_ref: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  sum_insured: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  premium: string;

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

  @ManyToOne(() => MotorFleet, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'fleet_id' })
  fleet: MotorFleet;

  @ManyToOne(() => MotorVehicle, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'motor_vehicle_id' })
  motor_vehicle: MotorVehicle;

  @ManyToOne(() => QuotationEntryRisk, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'quotation_entry_risk_id' })
  quotation_entry_risk: QuotationEntryRisk | null;
}
