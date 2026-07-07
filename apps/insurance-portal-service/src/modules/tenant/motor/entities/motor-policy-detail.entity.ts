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

  @Column({ type: 'uuid', nullable: true })
  tiramis_submission_tracking_id: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  tiramis_status: string | null;

  @Column({ type: 'uuid', nullable: true })
  tiramis_transaction_id: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  tiramis_request_id: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  tiramis_service_type: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  tiramis_root_element: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  tiramis_acknowledgement_status_code: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  tiramis_acknowledgement_status_desc: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  tiramis_final_response_id: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  tiramis_final_response_status_code: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  tiramis_final_response_status_desc: string | null;

  @Column({ type: 'text', nullable: true })
  tiramis_last_error_message: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  tiramis_last_synced_at: Date | null;

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
