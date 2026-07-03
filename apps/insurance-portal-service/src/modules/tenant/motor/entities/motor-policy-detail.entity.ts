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
import { Policy } from '../../policies/entities/policy.entity';
import { PolicyRisk } from '../../policies/entities/policy-risk.entity';

@Entity('motor_policy_details')
@Index('IDX_mpd_policy_id', ['policy_id'])
@Index('IDX_mpd_policy_risk_id', ['policy_risk_id'])
@Index('IDX_mpd_motor_vehicle_id', ['motor_vehicle_id'])
export class MotorPolicyDetail {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  policy_id: string;

  @Column({ type: 'uuid' })
  policy_risk_id: string;

  @Column({ type: 'uuid' })
  motor_vehicle_id: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  cover_type: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  usage_type: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  certificate_no: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  sticker_no: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

  @ManyToOne(() => MotorVehicle, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'motor_vehicle_id' })
  motor_vehicle: MotorVehicle;

  @ManyToOne(() => Policy, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'policy_id' })
  policy: Policy;

  @ManyToOne(() => PolicyRisk, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'policy_risk_id' })
  policy_risk: PolicyRisk;
}
