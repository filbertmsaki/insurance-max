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
import { Company } from '../../../platform/companies/entities/company.entity';
import { Customer } from '../../customers/entities/customer.entity';
import { User } from '../../users/entities/user.entity';

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

  @Column({ type: 'varchar', length: 50, nullable: true })
  registration_no: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  chassis_no: string | null;

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

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  vehicle_value: string;

  @Column({ type: 'varchar', length: 10, default: 'TZS' })
  currency: string;

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status: string;

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

  @ManyToOne(() => Customer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  creator: User | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'updated_by' })
  updater: User | null;
}
