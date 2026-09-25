import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Customer } from '../../customers/entities/customer.entity';
import { User } from '../../users/entities/user.entity';
import { MotorVehicle } from './motor-vehicle.entity';
import { MotorVehicleVersion } from './motor-vehicle-version.entity';

@Entity('motor_vehicle_audit_logs')
@Index('IDX_motor_vehicle_audit_logs_company_vehicle', [
  'company_id',
  'motor_vehicle_id',
])
@Index('IDX_motor_vehicle_audit_logs_version', ['motor_vehicle_version_id'])
export class MotorVehicleAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid' })
  motor_vehicle_id: string;

  @Column({ type: 'uuid', nullable: true })
  motor_vehicle_version_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  customer_id: string | null;

  @Column({ type: 'varchar', length: 40 })
  action: string;

  @Column({ type: 'jsonb', nullable: true })
  old_values: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  new_values: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  fields_changed: string[] | null;

  @Column({ type: 'uuid', nullable: true })
  user_id: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip_address: string | null;

  @Column({ type: 'varchar', length: 40, default: 'ADMIN_PORTAL' })
  source: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  related_record_type: string | null;

  @Column({ type: 'uuid', nullable: true })
  related_record_id: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @ManyToOne(() => MotorVehicle, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'motor_vehicle_id' })
  motor_vehicle: MotorVehicle;

  @ManyToOne(() => MotorVehicleVersion, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'motor_vehicle_version_id' })
  motor_vehicle_version: MotorVehicleVersion | null;

  @ManyToOne(() => Customer, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: User | null;
}
