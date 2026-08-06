import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { InsuredAsset } from '../../customers/entities/insured-asset.entity';
import { MotorFleet } from './motor-fleet.entity';
import { MotorVehicle } from './motor-vehicle.entity';

@Entity('motor_fleet_memberships')
export class MotorFleetMembership {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid' })
  fleet_id: string;

  @Column({ type: 'uuid' })
  motor_vehicle_id: string;

  @Column({ type: 'uuid' })
  insured_asset_id: string;

  @Column({ type: 'date', default: () => 'CURRENT_DATE' })
  effective_from: string;

  @Column({ type: 'date', nullable: true })
  effective_to: string | null;

  @Column({ type: 'varchar', length: 30, default: 'ACTIVE' })
  status: string;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => MotorFleet, (fleet) => fleet.memberships, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'fleet_id' })
  fleet: MotorFleet;

  @ManyToOne(() => MotorVehicle, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'motor_vehicle_id' })
  motor_vehicle: MotorVehicle;

  @ManyToOne(() => InsuredAsset, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'insured_asset_id' })
  insured_asset: InsuredAsset;
}
