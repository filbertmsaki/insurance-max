import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Company } from '../../../platform/companies/entities/company.entity';
import { Customer } from '../../customers/entities/customer.entity';
import { InsuredAsset } from '../../customers/entities/insured-asset.entity';
import { User } from '../../users/entities/user.entity';
import { MotorVehicleOwnership } from './motor-vehicle-ownership.entity';

@Entity('motor_vehicles')
@Index('IDX_motor_vehicles_company_id', ['company_id'])
@Index('IDX_motor_vehicles_company_customer_id', ['company_id', 'customer_id'])
@Index(
  'IDX_motor_vehicles_company_registration_no',
  ['company_id', 'registration_no'],
  {
    unique: true,
    where: 'deleted_at IS NULL AND registration_no IS NOT NULL',
  },
)
@Index('IDX_motor_vehicles_company_chassis_no', ['company_id', 'chassis_no'], {
  unique: true,
  where: 'deleted_at IS NULL AND chassis_no IS NOT NULL',
})
@Index('IDX_motor_vehicles_company_engine_no', ['company_id', 'engine_no'], {
  unique: true,
  where: 'deleted_at IS NULL AND engine_no IS NOT NULL',
})
export class MotorVehicle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid' })
  customer_id: string;

  @Column({ type: 'uuid', nullable: true })
  insured_asset_id: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  registration_no: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  registration_no_normalized: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  chassis_no: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  chassis_no_normalized: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  engine_no: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  make: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  model: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  body_type: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  color: string | null;

  @Column({ type: 'smallint', nullable: true })
  manufacture_year: number | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  usage_type: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  vehicle_category: string | null;

  @Column({ type: 'int', nullable: true })
  seating_capacity: number | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  tonnage: string | null;

  @Column({ type: 'int', nullable: true })
  cubic_capacity: number | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  fuel_type: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  model_no: string | null;

  @Column({ type: 'smallint', nullable: true })
  number_of_axles: number | null;

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  axle_distance: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  tare_weight: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  gross_weight: string | null;

  @Column({ type: 'smallint', nullable: true })
  motor_category: number | null;

  @Column({ type: 'smallint', nullable: true })
  motor_type: number | null;

  @Column({ type: 'smallint', nullable: true })
  motor_usage: number | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  owner_name: string | null;

  @Column({ type: 'smallint', nullable: true })
  owner_category: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  owner_address: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  vehicle_value: string;

  @Column({ type: 'varchar', length: 10, default: 'TZS' })
  currency: string;

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status: string;

  @Column({ type: 'int', default: 1 })
  snapshot_version: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @Column({ type: 'uuid', nullable: true })
  updated_by: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @ManyToOne(() => Customer, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @ManyToOne(() => InsuredAsset, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'insured_asset_id' })
  insured_asset: InsuredAsset | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  creator: User | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'updated_by' })
  updater: User | null;

  @OneToMany(
    () => MotorVehicleOwnership,
    (ownership) => ownership.motor_vehicle,
  )
  ownership_history: MotorVehicleOwnership[];
}
