import type { PaginatedResponse } from '@/modules/shared/api/pagination';
import type { CustomerRecord } from '@/modules/tenant/customers/types';
import type {
  InsuranceCategory,
  InsuranceProduct,
  InsuranceRisk,
  InsuranceSubClass,
  RiskPremiumResult,
  RatingFactor,
} from '@/types/product-engine';
import type { SortOrder } from '@/types';

export type QuotationType = 'MOTOR' | 'NON_MOTOR';
export type QuotationStatus =
  | 'DRAFT'
  | 'RATED'
  | 'REFERRED'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'CONVERTED'
  | 'EXPIRED'
  | 'CANCELLED';
export type ProductChannelType =
  | 'DIRECT'
  | 'BROKER'
  | 'AGENCY'
  | 'BANCASSURANCE'
  | 'API';

export interface QuotationRiskRecord {
  id: string;
  quotation_id: string;
  quotation_risk_no?: string | null;
  risk_id: string;
  subject_matter_id: string | null;
  motor_vehicle_id: string | null;
  sum_insured: string;
  rate: string;
  fixed_amount: string;
  basic_premium: string;
  discount_amount: string;
  tax_amount: string;
  charges_amount: string;
  commission_amount: string;
  total_premium: string;
  net_premium: string;
  rating_rule_id: string | null;
  rating_result_metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  risk?: InsuranceRisk | null;
  motor_vehicle?: { id: string; registration_no: string | null; chassis_no: string | null; engine_no: string | null } | null;
}

export interface QuotationFactorValueRecord {
  id: string;
  quotation_id: string;
  quotation_risk_id: string | null;
  factor_id: string;
  value_text: string | null;
  value_number: string | null;
  value_date: string | null;
  value_boolean: boolean | null;
  value_json: Record<string, unknown> | null;
  factor?: RatingFactor | null;
}

export interface QuotationPremiumBreakdownRecord {
  id: string;
  quotation_id: string;
  quotation_risk_id: string | null;
  item_type: string;
  item_code: string;
  item_name: string;
  rate: string | null;
  amount: string | null;
  calculation_base: string | null;
  calculation_order: number | null;
}

export interface QuotationStatusHistoryRecord {
  id: string;
  quotation_id: string;
  old_status: QuotationStatus | 'NONE' | null;
  new_status: QuotationStatus;
  reason: string | null;
  changed_by: string | null;
  created_at: string;
  changed_by_user?: { id: string; first_name: string; last_name: string; email: string } | null;
}

export interface QuotationRecord {
  id: string;
  company_id: string;
  insurer_company_id: string;
  intermediary_company_id: string | null;
  branch_id: string | null;
  department_id: string | null;
  created_by: string | null;
  customer_id: string;
  category_id: string;
  product_id: string;
  sub_class_id: string | null;
  quotation_no: string;
  quotation_type: QuotationType;
  channel_type: ProductChannelType;
  status: QuotationStatus;
  currency: string;
  sum_insured: string;
  basic_premium: string;
  total_discount: string;
  total_tax: string;
  total_charges: string;
  total_commission: string;
  total_premium: string;
  net_premium: string;
  valid_from: string;
  valid_until: string;
  rating_version: string | null;
  rating_metadata: Record<string, unknown> | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  customer?: CustomerRecord | null;
  insurer_company?: { id: string; name: string; slug: string } | null;
  intermediary_company?: { id: string; name: string; slug: string } | null;
  category?: InsuranceCategory | null;
  product?: InsuranceProduct | null;
  sub_class?: InsuranceSubClass | null;
  risks?: QuotationRiskRecord[];
  factor_values?: QuotationFactorValueRecord[];
  premium_breakdowns?: QuotationPremiumBreakdownRecord[];
  status_history?: QuotationStatusHistoryRecord[];
}

export interface QuotationListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: QuotationStatus;
  quotation_type?: QuotationType;
  customer_id?: string;
  product_id?: string;
  sortBy?: string;
  sortOrder?: SortOrder;
}

export interface QuotationPayload {
  insurer_company_id: string;
  intermediary_company_id?: string | null;
  branch_id?: string | null;
  department_id?: string | null;
  customer_id: string;
  category_id: string;
  product_id: string;
  sub_class_id?: string | null;
  quotation_type: QuotationType;
  channel_type: ProductChannelType;
  status?: QuotationStatus;
  currency?: string;
  sum_insured?: number | string | null;
  basic_premium?: number | string | null;
  total_discount?: number | string | null;
  total_tax?: number | string | null;
  total_charges?: number | string | null;
  total_commission?: number | string | null;
  total_premium?: number | string | null;
  net_premium?: number | string | null;
  valid_from: string;
  valid_until: string;
  rating_version?: string | null;
  rating_metadata?: Record<string, unknown> | null;
  rejection_reason?: string | null;
  risks?: Array<{
    risk_id: string;
    subject_matter_id?: string | null;
    motor_vehicle_id?: string | null;
    sum_insured?: number;
    rate?: number;
    fixed_amount?: number;
    basic_premium?: number;
    discount_amount?: number;
    tax_amount?: number;
    charges_amount?: number;
    commission_amount?: number;
    total_premium?: number;
    net_premium?: number;
    rating_rule_id?: string | null;
    rating_result_metadata?: Record<string, unknown> | null;
  }>;
  factor_values?: Array<{
    quotation_risk_id?: string | null;
    factor_id: string;
    value_text?: string | null;
    value_number?: number | null;
    value_date?: string | null;
    value_boolean?: boolean | null;
    value_json?: Record<string, unknown> | null;
  }>;
  premium_breakdowns?: Array<{
    quotation_risk_id?: string | null;
    item_type: string;
    item_code: string;
    item_name: string;
    rate?: number | null;
    amount?: number | null;
    calculation_base?: string | null;
    calculation_order?: number;
  }>;
}

export interface QuotationFormValues {
  insurer_company_id: string;
  intermediary_company_id: string;
  branch_id: string;
  department_id: string;
  customer_id: string;
  category_id: string;
  product_id: string;
  sub_class_id: string;
  quotation_type: QuotationType;
  channel_type: ProductChannelType;
  status: QuotationStatus;
  currency: string;
  sum_insured: string;
  basic_premium: string;
  total_discount: string;
  total_tax: string;
  total_charges: string;
  total_commission: string;
  total_premium: string;
  net_premium: string;
  valid_from: string;
  valid_until: string;
  rating_version: string;
  rejection_reason: string;
}

export type QuotationPage = PaginatedResponse<QuotationRecord>;

export interface QuotationWizardFactorInput {
  factor_id: string;
  label: string;
  data_type: string;
  value_text: string;
  value_number: string;
  value_date: string;
  value_boolean: boolean;
}

