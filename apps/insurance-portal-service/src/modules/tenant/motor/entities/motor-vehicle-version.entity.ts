import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { MotorVehicle } from './motor-vehicle.entity';

@Entity('motor_vehicle_versions')
@Index('IDX_motor_vehicle_versions_company_vehicle', [
  'company_id',
  'motor_vehicle_id',
])
@Index(
  'IDX_motor_vehicle_versions_current',
  ['company_id', 'motor_vehicle_id'],
  {
    where: 'is_current_version = true',
  },
)
@Index(
  'UQ_motor_vehicle_versions_number',
  ['motor_vehicle_id', 'version_number'],
  { unique: true },
)
export class MotorVehicleVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid' })
  motor_vehicle_id: string;

  @Column({ type: 'int' })
  version_number: number;

  @Column({ type: 'boolean', default: false })
  is_current_version: boolean;

  @Column({ type: 'jsonb' })
  vehicle_snapshot: Record<string, unknown>;

  @Column({ type: 'varchar', length: 64 })
  vehicle_snapshot_hash: string;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @ManyToOne(() => MotorVehicle, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'motor_vehicle_id' })
  motor_vehicle: MotorVehicle;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  creator: User | null;
}
