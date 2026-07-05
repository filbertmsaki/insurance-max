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

import { Company } from '../../platform/companies/entities/company.entity';
import { Branch } from '../../tenant/branches/entities/branch.entity';
import { Department } from '../../tenant/departments/entities/department.entity';
import { Customer } from '../../tenant/customers/entities/customer.entity';
import { MotorVehicle } from '../../tenant/motor/entities/motor-vehicle.entity';
import { Policy } from '../../tenant/policies/entities/policy.entity';

@Entity('tiramis_business_records')
@Index('IDX_tiramis_business_records_company', ['companyId'])
@Index('IDX_tiramis_business_records_source', ['sourceModule', 'requestType'])
@Index('IDX_tiramis_business_records_reference', ['businessReference'])
@Index('IDX_tiramis_business_records_status', ['status'])
export class TiramisBusinessRecordEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'company_id', type: 'uuid' })
  companyId!: string;

  @Column({ name: 'branch_id', type: 'uuid', nullable: true })
  branchId!: string | null;

  @Column({ name: 'department_id', type: 'uuid', nullable: true })
  departmentId!: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @Column({ name: 'source_module', type: 'varchar', length: 80 })
  sourceModule!: string;

  @Column({ name: 'request_type', type: 'varchar', length: 80 })
  requestType!: string;

  @Column({ name: 'business_reference', type: 'varchar', length: 150 })
  businessReference!: string;

  @Column({ name: 'policy_id', type: 'uuid', nullable: true })
  policyId!: string | null;

  @Column({ name: 'customer_id', type: 'uuid', nullable: true })
  customerId!: string | null;

  @Column({ name: 'motor_vehicle_id', type: 'uuid', nullable: true })
  motorVehicleId!: string | null;

  @Column({ name: 'status', type: 'varchar', length: 40, default: 'DRAFT' })
  status!: string;

  @Column({ name: 'payload', type: 'jsonb', default: {} })
  payload!: Record<string, any>;

  @Column({ name: 'metadata', type: 'jsonb', nullable: true })
  metadata!: Record<string, any> | null;

  @Column({
    name: 'tiramis_submission_tracking_id',
    type: 'uuid',
    nullable: true,
  })
  tiramisSubmissionTrackingId!: string | null;

  @Column({ name: 'tiramis_status', type: 'varchar', length: 50, nullable: true })
  tiramisStatus!: string | null;

  @Column({
    name: 'tiramis_transaction_id',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  tiramisTransactionId!: string | null;

  @Column({
    name: 'tiramis_request_id',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  tiramisRequestId!: string | null;

  @Column({
    name: 'tiramis_service_type',
    type: 'varchar',
    length: 80,
    nullable: true,
  })
  tiramisServiceType!: string | null;

  @Column({
    name: 'tiramis_root_element',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  tiramisRootElement!: string | null;

  @Column({
    name: 'tiramis_acknowledgement_status_code',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  tiramisAcknowledgementStatusCode!: string | null;

  @Column({
    name: 'tiramis_acknowledgement_status_desc',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  tiramisAcknowledgementStatusDesc!: string | null;

  @Column({
    name: 'tiramis_final_response_id',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  tiramisFinalResponseId!: string | null;

  @Column({
    name: 'tiramis_final_response_status_code',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  tiramisFinalResponseStatusCode!: string | null;

  @Column({
    name: 'tiramis_final_response_status_desc',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  tiramisFinalResponseStatusDesc!: string | null;

  @Column({ name: 'tiramis_last_error_message', type: 'text', nullable: true })
  tiramisLastErrorMessage!: string | null;

  @Column({ name: 'tiramis_last_synced_at', type: 'timestamptz', nullable: true })
  tiramisLastSyncedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company!: Company;

  @ManyToOne(() => Branch, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'branch_id' })
  branch!: Branch | null;

  @ManyToOne(() => Department, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'department_id' })
  department!: Department | null;

  @ManyToOne(() => Policy, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'policy_id' })
  policy!: Policy | null;

  @ManyToOne(() => Customer, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'customer_id' })
  customer!: Customer | null;

  @ManyToOne(() => MotorVehicle, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'motor_vehicle_id' })
  motorVehicle!: MotorVehicle | null;
}
