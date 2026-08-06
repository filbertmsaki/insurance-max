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

  @Column({
    name: 'source_product_id',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  sourceProductId?: string | null;

  @Column({
    name: 'source_product_version_id',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  sourceProductVersionId?: string | null;

  @Column({
    name: 'source_product_version_number',
    type: 'int',
    nullable: true,
  })
  sourceProductVersionNumber?: number | null;

  @Column({
    name: 'source_product_code',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  sourceProductCode?: string | null;

  @Column({
    name: 'source_tiramis_product_code',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  sourceTiramisProductCode?: string | null;

  @Column({
    name: 'source_product_definition_hash',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  sourceProductDefinitionHash?: string | null;

  @Column({
    name: 'source_pricing_quote_id',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  sourcePricingQuoteId?: string | null;

  @Column({
    name: 'source_rate_book_id',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  sourceRateBookId?: string | null;

  @Column({
    name: 'source_rate_book_code',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  sourceRateBookCode?: string | null;

  @Column({
    name: 'source_rate_book_version',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  sourceRateBookVersion?: string | null;

  @Column({
    name: 'source_rate_book_definition_hash',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  sourceRateBookDefinitionHash?: string | null;

  @Column({
    name: 'source_rating_rule_id',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  sourceRatingRuleId?: string | null;

  @Column({
    name: 'source_rating_rule_code',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  sourceRatingRuleCode?: string | null;

  @Column({
    name: 'source_rating_rule_version',
    type: 'int',
    nullable: true,
  })
  sourceRatingRuleVersion?: number | null;

  @Column({
    name: 'source_pricing_input_hash',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  sourcePricingInputHash?: string | null;

  @Column({
    name: 'source_pricing_result_hash',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  sourcePricingResultHash?: string | null;

  @Column({
    name: 'source_calculation_version',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  sourceCalculationVersion?: string | null;

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
