import type { PaginatedResponse } from '@/modules/shared/api/pagination';
import type { CustomerRecord } from '@/modules/tenant/customers/types';
import type {
  InsuranceCategory,
  InsuranceProduct,
  InsuranceRisk,
  InsuranceSubClass,
} from '@/types/product-engine';
import type {
  ProductChannelType,
  QuotationRiskRecord,
  QuotationStatusHistoryRecord,
} from '../quotations/types';
import type { SortOrder } from '@/types';

export type PolicyStatus = string;

export interface PolicyRiskRecord {
  id: string;
  policy_id: string;
  quotation_risk_id: string | null;
  risk_id: string;
  subject_matter_id: string | null;
  motor_vehicle_id: string | null;
  sum_insured: string;
  rate: string;
  basic_premium: string;
  discount_amount: string;
  tax_amount: string;
  charges_amount: string;
  commission_amount: string;
  total_premium: string;
  net_premium: string;
  reinsurance_required: boolean;
  retention_amount: string;
  ceded_sum_insured: string;
  ceded_premium: string;
  reinsurance_status: string;
  status: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  risk?: InsuranceRisk | null;
  quotation_risk?: QuotationRiskRecord | null;
  motor_vehicle?: {
    id: string;
    registration_no: string | null;
    chassis_no: string | null;
    engine_no: string | null;
  } | null;
}

export interface PolicyPremiumBreakdownRecord {
  id: string;
  policy_id: string;
  policy_risk_id: string | null;
  item_type: string;
  item_code: string;
  item_name: string;
  rate: string | null;
  amount: string | null;
  calculation_base: string | null;
  calculation_order: number | null;
}

export interface PolicyStatusHistoryRecord extends QuotationStatusHistoryRecord {
  policy_id: string;
  changed_by?: string | null;
  changer?: { id: string; first_name: string; last_name: string } | null;
}

export type PolicyTransactionStage =
  | 'DRAFT'
  | 'COMPLETED'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'PAYMENT_PENDING'
  | 'SUBMISSION_PROCESSING'
  | 'APPLIED'
  | 'REJECTED'
  | 'CANCELLED'
  | string;

export type PolicyTransactionSubmissionStatus =
  | 'NOT_READY'
  | 'READY'
  | 'PROCESSING'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'FAILED'
  | 'RETRYABLE'
  | string;

export type EndorsementPremiumEffect = 'NONE' | 'DEBIT' | 'CREDIT';

export interface EndorsementRiskPricing {
  entryIndex: number;
  riskIndex: number;
  quotationRiskId: string | null;
  insuranceRiskId: string;
  sourcePricingQuoteId: string;
  sumInsured: string;
  finalPayablePremium: string;
  premiumExcludingTax: string;
  taxAmount: string;
  chargeAmount: string;
  discountApprovalRequired: boolean;
  loadingApprovalRequired: boolean;
  resultHash: string;
  factors: Record<string, string | number | boolean>;
}

export interface EndorsementPricingSnapshot {
  sourcePolicyPremium: string;
  revisedFullTermPremium: string;
  earnedPremiumBeforeChange: string;
  remainingOldPremium: string;
  remainingNewPremium: string;
  premiumDifference: string;
  taxDifference: string;
  chargeDifference: string;
  commissionDifference: string;
  customerPayableDifference: string;
  premiumEffect: EndorsementPremiumEffect;
  currencyCode: string;
  effectiveDate: string;
  calculationMethod: string;
  pricingResultHashes: string[];
  sourceRiskPricing: EndorsementRiskPricing[];
  proposedRiskPricing: EndorsementRiskPricing[];
  pricingApprovalRequired: boolean;
  snapshotHash: string;
}

export interface PolicyEndorsementRecord {
  id: string;
  company_id: string;
  transaction_no: string;
  transaction_type: 'ENDORSEMENT' | string;
  stage: PolicyTransactionStage;
  approval_status: string;
  payment_status: string;
  submission_status: PolicyTransactionSubmissionStatus;
  source_policy_id: string;
  effective_date: string;
  reason: string;
  approval_required: boolean;
  payment_required: boolean;
  premium_effect: EndorsementPremiumEffect;
  additional_premium: string;
  return_premium: string;
  net_premium_difference: string;
  tax_difference: string;
  commission_difference: string;
  currency_code: string;
  pricing_snapshot: EndorsementPricingSnapshot | null;
  pricing_snapshot_hash: string | null;
  active_invoice_id: string | null;
  previous_cover_note_reference: string | null;
  replacement_cover_note_reference: string | null;
  tiramis_tracking_id: string | null;
  tiramis_transaction_id: string | null;
  tiramis_request_id: string | null;
  target_policy_id: string | null;
  target_policy_version_id: string | null;
  regulatory_response: Record<string, unknown> | null;
  regulatory_response_hash: string | null;
  created_at: string;
  updated_at: string;
}

export interface EndorsementEligibilityBlocker {
  code: string;
  message: string;
}

export interface EndorsementEligibility {
  eligible: boolean;
  blockers: EndorsementEligibilityBlocker[];
  policy: {
    id: string;
    policy_no: string;
    policy_status: string;
    quotation_id: string | null;
    start_date: string;
    end_date: string;
    currency: string;
    pending_transaction_id: string | null;
    cover_note_no: string | null;
    tira_status: string;
  };
  current_version: {
    id: string;
    version_number: number;
    version_type: string;
    effective_from: string;
    effective_to: string;
    regulatory_reference: string | null;
    snapshot_schema_version: number;
  } | null;
}

export type CancellationReasonType =
  | 'CUSTOMER_REQUEST'
  | 'NON_PAYMENT'
  | 'DUPLICATE_POLICY'
  | 'RISK_NO_LONGER_EXISTS'
  | 'MATERIAL_MISREPRESENTATION'
  | 'FRAUD'
  | 'POLICY_REPLACEMENT'
  | 'OTHER';

export interface CancellationEligibility extends EndorsementEligibility {
  claimsReviewRequired: boolean;
}

export interface CreateCancellationPayload {
  effective_date: string;
  reason_type: CancellationReasonType;
  reason: string;
  idempotency_key: string;
}

export interface PolicyCancellationRecord {
  id: string;
  company_id: string;
  transaction_no: string;
  transaction_type: 'CANCELLATION' | string;
  stage: PolicyTransactionStage;
  approval_status: string;
  payment_status: string;
  submission_status: PolicyTransactionSubmissionStatus;
  source_policy_id: string;
  effective_date: string;
  reason: string;
  approval_required: boolean;
  payment_required: boolean;
  premium_effect: EndorsementPremiumEffect;
  additional_premium: string;
  return_premium: string;
  net_premium_difference: string;
  currency_code: string;
  pricing_snapshot: Record<string, unknown> | null;
  active_invoice_id: string | null;
  tiramis_request_id: string | null;
  target_policy_id: string | null;
  target_policy_version_id: string | null;
  regulatory_response: Record<string, unknown> | null;
  cancellation_reason?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PolicyCancellationDetail {
  id: string;
  reason_type: CancellationReasonType;
  cancellation_method: string;
  requested_effective_date: string;
  policy_days: number;
  days_on_risk: number;
  remaining_days: number;
  gross_written_premium: string;
  earned_premium: string;
  unearned_premium: string;
  cancellation_charge: string;
  refund_amount: string;
  amount_due: string;
  claims_review_required: boolean;
  claims_review_status: string;
  previous_cover_note_reference: string | null;
  cancellation_cover_note_reference: string | null;
}

export interface CancellationContext {
  transaction: PolicyCancellationRecord;
  cancellation: PolicyCancellationDetail;
}

export interface PolicyTransactionSummary {
  id: string;
  transaction_type: 'ENDORSEMENT' | 'CANCELLATION' | 'RENEWAL' | string;
  stage: string;
}

export interface RenewalEligibility {
  eligible: boolean;
  blockers: EndorsementEligibilityBlocker[];
  renewalStartDate: string | null;
  renewalEndDate: string | null;
  coverNoteEndDate: string | null;
  prevCoverNoteReferenceNumber: string | null;
  renewalOfPolicyId: string | null;
  renewalSequence: number | null;
  renewalWindowBeforeDays: number;
  renewalWindowAfterDays: number;
  renewalProductVersionId: string | null;
  renewalProductDefinitionHash: string | null;
  currentVersion: {
    id: string;
    version_number: number;
    version_type: string;
    regulatory_reference: string | null;
  } | null;
}

export interface PolicyRenewalRecord {
  id: string;
  company_id: string;
  policy_transaction_id: string;
  renewal_no: string;
  renewal_status: string;
  renewal_start_date: string;
  renewal_end_date: string;
  offer_expires_at: string | null;
  source_cover_note_reference: string;
  previous_policy_id: string | null;
  previous_cover_note_reference_number: string | null;
  renewal_of_policy_id: string | null;
  renewal_sequence: number;
  renewal_quotation_id: string | null;
  renewed_policy_id: string | null;
  customer_accepted_at: string | null;
  customer_declined_at: string | null;
  decline_reason: string | null;
  created_at: string;
}

export interface RenewalContext {
  renewal: PolicyRenewalRecord;
  transaction: {
    id: string;
    stage: PolicyTransactionStage;
    source_policy_id: string;
    source_policy_version_id: string;
    target_policy_id: string | null;
  } | null;
  source_policy: PolicyRecord | null;
  renewal_quotation: {
    id: string;
    quotation_no: string;
    status: string;
    quotation_stage?: string;
    payment_status?: string;
    payment_status_v2?: string;
    submission_status_v2?: string;
  } | null;
}

export interface EndorsementTypeRecord {
  id: string;
  company_id: string;
  code: string;
  name: string;
  tira_endorsement_type: number | null;
  requires_new_cover_note: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateEndorsementTypePayload {
  code: string;
  name: string;
  tira_endorsement_type?: number | null;
  requires_new_cover_note?: boolean;
  is_active?: boolean;
}

export interface UpdateEndorsementTypePayload {
  name?: string;
  tira_endorsement_type?: number | null;
  requires_new_cover_note?: boolean;
  is_active?: boolean;
}

export interface PolicyTransactionChangeRecord {
  id: string;
  company_id: string;
  policy_transaction_id: string;
  category: string;
  operation: 'ADD' | 'MODIFY' | 'REMOVE';
  field_path: string;
  resource_id: string | null;
  old_value: unknown;
  new_value: unknown;
  is_material: boolean;
  requires_repricing: boolean;
  requires_regulatory_submission: boolean;
  change_hash: string;
  created_by: string;
  created_at: string;
}

export interface EndorsementContext {
  transaction: PolicyEndorsementRecord & {
    source_policy_version_id: string;
    source_policy_version_no: number;
    source_policy_snapshot: Record<string, unknown>;
    source_policy_snapshot_hash: string;
    proposed_policy_snapshot: Record<string, unknown> | null;
    proposed_policy_snapshot_hash: string | null;
  };
  endorsement: {
    id: string;
    endorsement_type_code: string;
    endorsement_type_name: string;
    tira_endorsement_type: number | null;
    previous_cover_note_reference: string;
    replacement_cover_note_reference: string | null;
    requires_new_cover_note: boolean;
  } | null;
  changes: PolicyTransactionChangeRecord[];
  source_policy_snapshot: Record<string, unknown>;
  proposed_policy_snapshot: Record<string, unknown>;
}

export interface CreateEndorsementPayload {
  effective_date: string;
  endorsement_type_code: string;
  reason: string;
  idempotency_key: string;
}

export interface RecordEndorsementChangePayload {
  category: 'POLICYHOLDER' | 'COVER_PERIOD' | 'ASSET' | 'SUM_INSURED' | 'COVER';
  operation: 'ADD' | 'MODIFY' | 'REMOVE';
  field_path: string;
  resource_id?: string;
  new_value: unknown;
}

export interface PolicyRecord {
  id: string;
  company_id: string;
  insurer_company_id: string;
  intermediary_company_id: string | null;
  branch_id: string | null;
  department_id: string | null;
  created_by: string | null;
  customer_id: string;
  quotation_id: string | null;
  source_quotation_revision: number | null;
  source_finalization_hash: string | null;
  proposal_id: string | null;
  category_id: string;
  product_id: string;
  product_version_id: string | null;
  sub_class_id: string | null;
  policy_no: string;
  cover_note_no: string | null;
  external_policy_no: string | null;
  policy_reference_number: string | null;
  channel_type: ProductChannelType;
  policy_status: PolicyStatus;
  pending_transaction_id: string | null;
  renewed_from_policy_id: string | null;
  renewed_to_policy_id: string | null;
  previous_policy_id: string | null;
  previous_cover_note_reference_number: string | null;
  renewal_of_policy_id: string | null;
  renewal_sequence: number;
  regulatory_sync_status: string;
  source_cover_note_count: number;
  issued_by_system: boolean;
  start_date: string;
  end_date: string;
  issue_date: string;
  currency: string;
  sum_insured: string;
  basic_premium: string;
  total_discount: string;
  total_tax: string;
  total_charges: string;
  total_commission: string;
  total_premium: string;
  net_premium: string;
  reinsurance_required: boolean;
  reinsurance_status: string;
  retention_amount: string;
  ceded_sum_insured: string;
  ceded_premium: string;
  tira_status: string;
  tira_portal_transaction_id: string | null;
  tiramis_transaction_id: string | null;
  tiramis_submission_tracking_id: string | null;
  tiramis_status: string | null;
  tiramis_request_id: string | null;
  tiramis_service_type: string | null;
  tiramis_root_element: string | null;
  tiramis_acknowledgement_status_code: string | null;
  tiramis_acknowledgement_status_desc: string | null;
  tiramis_final_response_id: string | null;
  tiramis_final_response_status_code: string | null;
  tiramis_final_response_status_desc: string | null;
  tiramis_last_error_message: string | null;
  tiramis_last_synced_at: string | null;
  tiramis_payload: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  customer?: CustomerRecord | null;
  insurer_company?: { id: string; name: string; slug: string } | null;
  intermediary_company?: { id: string; name: string; slug?: string } | null;
  branch?: { id: string; name: string; code?: string | null } | null;
  department?: { id: string; name: string; code?: string | null } | null;
  category?: InsuranceCategory | null;
  product?: InsuranceProduct | null;
  sub_class?: InsuranceSubClass | null;
  risks?: PolicyRiskRecord[];
  premium_breakdowns?: PolicyPremiumBreakdownRecord[];
  status_history?: PolicyStatusHistoryRecord[];
}

export interface PolicyVersionRecord {
  id: string;
  company_id: string;
  policy_id: string;
  version_number: number;
  version_type: string;
  status: string;
  effective_from: string;
  effective_to: string;
  policy_snapshot: Record<string, unknown>;
  policy_snapshot_hash: string;
  pricing_snapshot: Record<string, unknown>;
  pricing_result_hash: string;
  customer_snapshot: Record<string, unknown>;
  customer_snapshot_hash: string;
  asset_manifest: Record<string, unknown>;
  asset_manifest_hash: string;
  tiramis_tracking_id: string | null;
  policy_transaction_id: string | null;
  supersedes_version_id: string | null;
  superseded_at: string | null;
  is_current: boolean;
  regulatory_reference: string | null;
  effective_transaction_date: string | null;
  created_by: string | null;
  created_at: string;
}

export interface PolicyListParams {
  page?: number;
  limit?: number;
  search?: string;
  policy_status?: string;
  customer_id?: string;
  sortBy?: string;
  sortOrder?: SortOrder;
}

export interface PolicyPayload {
  insurer_company_id: string;
  intermediary_company_id?: string | null;
  branch_id?: string | null;
  department_id?: string | null;
  customer_id: string;
  quotation_id?: string | null;
  proposal_id?: string | null;
  category_id: string;
  product_id: string;
  sub_class_id?: string | null;
  channel_type: ProductChannelType;
  policy_status?: string;
  start_date: string;
  end_date: string;
  issue_date: string;
  currency?: string;
  sum_insured?: number | string | null;
  basic_premium?: number | string | null;
  total_discount?: number | string | null;
  total_tax?: number | string | null;
  total_charges?: number | string | null;
  total_commission?: number | string | null;
  total_premium?: number | string | null;
  net_premium?: number | string | null;
  reinsurance_required?: boolean;
  reinsurance_status?: string;
  retention_amount?: number | string | null;
  ceded_sum_insured?: number | string | null;
  ceded_premium?: number | string | null;
  tira_status?: string;
  tira_portal_transaction_id?: string | null;
  tiramis_transaction_id?: string | null;
  metadata?: Record<string, unknown> | null;
  risks?: Array<{
    quotation_risk_id?: string | null;
    risk_id: string;
    subject_matter_id?: string | null;
    motor_vehicle_id?: string | null;
    sum_insured?: number | string | null;
    rate?: number | string | null;
    basic_premium?: number | string | null;
    discount_amount?: number | string | null;
    tax_amount?: number | string | null;
    charges_amount?: number | string | null;
    commission_amount?: number | string | null;
    total_premium?: number | string | null;
    net_premium?: number | string | null;
    reinsurance_required?: boolean;
    retention_amount?: number | string | null;
    ceded_sum_insured?: number | string | null;
    ceded_premium?: number | string | null;
    reinsurance_status?: string | null;
    status?: string;
  }>;
  premium_breakdowns?: Array<{
    policy_risk_id?: string | null;
    item_type: string;
    item_code: string;
    item_name: string;
    rate?: number | string | null;
    amount?: number | string | null;
    calculation_base?: string | null;
    calculation_order?: number;
  }>;
}

export interface PolicyFormValues {
  insurer_company_id: string;
  intermediary_company_id: string;
  branch_id: string;
  department_id: string;
  customer_id: string;
  quotation_id: string;
  proposal_id: string;
  category_id: string;
  product_id: string;
  sub_class_id: string;
  channel_type: ProductChannelType;
  policy_status: string;
  start_date: string;
  end_date: string;
  issue_date: string;
  currency: string;
  sum_insured: string;
  basic_premium: string;
  total_discount: string;
  total_tax: string;
  total_charges: string;
  total_commission: string;
  total_premium: string;
  net_premium: string;
  reinsurance_required: boolean;
  reinsurance_status: string;
  retention_amount: string;
  ceded_sum_insured: string;
  ceded_premium: string;
  tira_status: string;
  tira_portal_transaction_id: string;
  tiramis_transaction_id: string;
}

export type PolicyPage = PaginatedResponse<PolicyRecord>;
