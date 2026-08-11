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
  premium_effect: string;
  additional_premium: string;
  return_premium: string;
  net_premium_difference: string;
  currency_code: string;
  tiramis_tracking_id: string | null;
  tiramis_transaction_id: string | null;
  tiramis_request_id: string | null;
  regulatory_response: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
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
  proposal_id: string | null;
  category_id: string;
  product_id: string;
  sub_class_id: string | null;
  policy_no: string;
  cover_note_no: string | null;
  external_policy_no: string | null;
  channel_type: ProductChannelType;
  policy_status: PolicyStatus;
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
  category?: InsuranceCategory | null;
  product?: InsuranceProduct | null;
  sub_class?: InsuranceSubClass | null;
  risks?: PolicyRiskRecord[];
  premium_breakdowns?: PolicyPremiumBreakdownRecord[];
  status_history?: PolicyStatusHistoryRecord[];
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
