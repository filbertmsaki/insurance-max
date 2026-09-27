import { BaseEntity } from '@insurance-max/persistence';
import { Column, Entity, Index } from 'typeorm';

@Entity({ name: 'tiramis_transactions' })
@Index(['businessReference'])
@Index(['currentRequestId'])
@Index(['successfulRequestId'])
@Index(['sourceQuotationId'])
@Index(['sourceWorkflowGateHash'])
@Index(['requestType'])
@Index(['idempotencyKey'])
export class TiramisTransactionEntity extends BaseEntity {
  @Column({
    name: 'schema_version',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  schemaVersion?: string | null;

  @Column({
    name: 'contract_version',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  contractVersion?: string | null;

  @Column({
    name: 'command',
    type: 'varchar',
    length: 40,
    nullable: true,
  })
  command?: string | null;

  @Column({
    name: 'request_type',
    type: 'varchar',
    length: 80,
    nullable: true,
  })
  requestType?: string | null;

  @Column({
    name: 'canonical_status',
    type: 'varchar',
    length: 60,
    nullable: true,
  })
  canonicalStatus?: string | null;

  @Column({
    name: 'idempotency_key',
    type: 'varchar',
    length: 180,
    nullable: true,
  })
  idempotencyKey?: string | null;

  @Column({
    name: 'correlation_id',
    type: 'uuid',
    nullable: true,
  })
  correlationId?: string | null;

  @Column({
    name: 'causation_id',
    type: 'uuid',
    nullable: true,
  })
  causationId?: string | null;

  @Column({
    name: 'resource_version',
    type: 'int',
    default: 1,
  })
  resourceVersion!: number;

  @Column({
    name: 'envelope',
    type: 'jsonb',
    nullable: true,
  })
  envelope?: Record<string, unknown> | null;

  @Column({
    name: 'payload_hash',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  payloadHash?: string | null;

  @Column({
    name: 'context_hash',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  contextHash?: string | null;

  @Column({
    name: 'envelope_hash',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  envelopeHash?: string | null;

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
    name: 'source_policy_id',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  sourcePolicyId?: string | null;

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
    name: 'portal_webhook_url',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  portalWebhookUrl?: string | null;

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

  @Column({
    name: 'source_customer_id',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  sourceCustomerId?: string | null;

  @Column({
    name: 'source_customer_number',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  sourceCustomerNumber?: string | null;

  @Column({
    name: 'source_customer_kyc_status',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  sourceCustomerKycStatus?: string | null;

  @Column({
    name: 'source_customer_kyc_version',
    type: 'int',
    nullable: true,
  })
  sourceCustomerKycVersion?: number | null;

  @Column({
    name: 'source_customer_snapshot_hash',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  sourceCustomerSnapshotHash?: string | null;

  @Column({
    name: 'source_tiramis_policy_holder_hash',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  sourceTiramisPolicyHolderHash?: string | null;

  @Column({
    name: 'source_asset_manifest_hash',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  sourceAssetManifestHash?: string | null;

  @Column({
    name: 'source_asset_count',
    type: 'int',
    nullable: true,
  })
  sourceAssetCount?: number | null;

  @Column({
    name: 'source_quotation_id',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  sourceQuotationId?: string | null;

  @Column({
    name: 'source_quotation_number',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  sourceQuotationNumber?: string | null;

  @Column({
    name: 'source_workflow_revision',
    type: 'int',
    nullable: true,
  })
  sourceWorkflowRevision?: number | null;

  @Column({
    name: 'source_quotation_stage',
    type: 'varchar',
    length: 40,
    nullable: true,
  })
  sourceQuotationStage?: string | null;

  @Column({
    name: 'source_approval_status',
    type: 'varchar',
    length: 40,
    nullable: true,
  })
  sourceApprovalStatus?: string | null;

  @Column({
    name: 'source_payment_status',
    type: 'varchar',
    length: 40,
    nullable: true,
  })
  sourcePaymentStatus?: string | null;

  @Column({
    name: 'source_finalization_hash',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  sourceFinalizationHash?: string | null;

  @Column({
    name: 'source_workflow_gate_hash',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  sourceWorkflowGateHash?: string | null;

  @Column({
    name: 'source_invoice_id',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  sourceInvoiceId?: string | null;

  @Column({
    name: 'source_invoice_number',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  sourceInvoiceNumber?: string | null;

  @Column({
    name: 'source_invoice_status',
    type: 'varchar',
    length: 40,
    nullable: true,
  })
  sourceInvoiceStatus?: string | null;

  @Column({
    name: 'source_allocated_amount',
    type: 'numeric',
    precision: 20,
    scale: 4,
    nullable: true,
  })
  sourceAllocatedAmount?: string | null;

  @Column({
    name: 'source_invoice_balance_amount',
    type: 'numeric',
    precision: 20,
    scale: 4,
    nullable: true,
  })
  sourceInvoiceBalanceAmount?: string | null;

  @Column({
    name: 'source_payment_gate_hash',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  sourcePaymentGateHash?: string | null;

  @Column({
    name: 'source_commission_accrual_id',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  sourceCommissionAccrualId?: string | null;

  @Column({
    name: 'source_commission_rate',
    type: 'numeric',
    precision: 18,
    scale: 10,
    nullable: true,
  })
  sourceCommissionRate?: string | null;

  @Column({
    name: 'source_commission_amount',
    type: 'numeric',
    precision: 20,
    scale: 4,
    nullable: true,
  })
  sourceCommissionAmount?: string | null;

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
