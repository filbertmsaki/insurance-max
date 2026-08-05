import { BaseEntity } from '@insurance-max/persistence';
import { Column, Entity, Index } from 'typeorm';

@Entity({ name: 'tiramis_transactions' })
@Index(['businessReference'])
@Index(['currentRequestId'])
@Index(['successfulRequestId'])
export class TiramisTransactionEntity extends BaseEntity {
  @Column({ name: 'client_configuration_id' })
  clientConfigurationId!: string;

  @Column({ name: 'service_type', length: 80 })
  serviceType!: string;

  @Column({
    name: 'source_service',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  sourceService?: string | null;

  @Column({
    name: 'source_module',
    type: 'varchar',
    length: 80,
    nullable: true,
  })
  sourceModule?: string | null;

  @Column({
    name: 'source_record_id',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  sourceRecordId?: string | null;

  @Column({
    name: 'source_company_id',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  sourceCompanyId?: string | null;

  @Column({
    name: 'source_user_id',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  sourceUserId?: string | null;

  @Column({
    name: 'source_branch_id',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  sourceBranchId?: string | null;

  @Column({
    name: 'source_department_id',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  sourceDepartmentId?: string | null;

  @Column({
    name: 'source_sale_point_id',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  sourceSalePointId?: string | null;

  @Column({
    name: 'source_sale_point_code',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  sourceSalePointCode?: string | null;

  @Column({
    name: 'source_company_membership_id',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  sourceCompanyMembershipId?: string | null;

  @Column({ name: 'business_reference', length: 100 })
  businessReference!: string;

  @Column({ length: 50, default: 'PENDING' })
  status!: string;

  @Column({
    name: 'original_request_id',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  originalRequestId?: string | null;

  @Column({
    name: 'current_request_id',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  currentRequestId?: string | null;

  @Column({
    name: 'successful_request_id',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  successfulRequestId?: string | null;

  @Column({ name: 'total_attempts', type: 'int', default: 0 })
  totalAttempts!: number;

  @Column({ name: 'last_attempt_at', type: 'timestamp', nullable: true })
  lastAttemptAt?: Date | null;

  @Column({ name: 'successful_at', type: 'timestamp', nullable: true })
  successfulAt?: Date | null;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError?: string | null;
}
