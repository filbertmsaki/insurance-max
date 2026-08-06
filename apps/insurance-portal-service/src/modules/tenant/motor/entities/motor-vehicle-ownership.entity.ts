import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Customer } from '../../customers/entities/customer.entity';
import { InsuredAsset } from '../../customers/entities/insured-asset.entity';
import { MotorVehicle } from './motor-vehicle.entity';

@Entity('motor_vehicle_ownerships')
export class MotorVehicleOwnership {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid' })
  motor_vehicle_id: string;

  @Column({ type: 'uuid' })
  insured_asset_id: string;

  @Column({ type: 'uuid' })
  owner_customer_id: string;

  @Column({ type: 'varchar', length: 30, default: 'OWNED' })
  ownership_type: string;

  @Column({ type: 'date', default: () => 'CURRENT_DATE' })
  effective_from: string;

  @Column({ type: 'date', nullable: true })
  effective_to: string | null;

  @Column({ type: 'text', nullable: true })
  change_reason: string | null;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @ManyToOne(() => MotorVehicle, (vehicle) => vehicle.ownership_history, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'motor_vehicle_id' })
  motor_vehicle: MotorVehicle;

  @ManyToOne(() => InsuredAsset, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'insured_asset_id' })
  insured_asset: InsuredAsset;

  @ManyToOne(() => Customer, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'owner_customer_id' })
  owner_customer: Customer;
}
