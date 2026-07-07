import type { RatingFactor } from '@/types/product-engine';
import type {
  MotorCustomerOption,
  PolicyOption,
  PolicyRiskOption,
  QuotationOption,
  CustomerRiskOption,
} from '@/modules/tenant/motor/types';

export interface SubjectMatterRecord {
  id: string;
  company_id: string;
  customer_id: string;
  subject_type: string | null;
  subject_code: string;
  description: string | null;
  location: string | null;
  country: string | null;
  region: string | null;
  district: string | null;
  ward: string | null;
  latitude: string | null;
  longitude: string | null;
  value: string;
  currency: string;
  status: string;
  metadata: Record<string, unknown> | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  customer?: MotorCustomerOption | null;
  factor_values?: SubjectMatterFactorValueRecord[];
}

export interface SubjectMatterPayload {
  customer_id: string;
  subject_type?: string | null;
  subject_code: string;
  description?: string | null;
  location?: string | null;
  country?: string | null;
  region?: string | null;
  district?: string | null;
  ward?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  value?: number | string | null;
  currency?: string;
  status?: string;
  metadata?: Record<string, unknown> | null;
}

export interface SubjectMatterListParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface SubjectMatterFactorValueRecord {
  id: string;
  subject_matter_id: string;
  factor_id: string;
  value_text: string | null;
  value_number: string | null;
  value_date: string | null;
  value_boolean: boolean | null;
  value_json: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  subject_matter?: SubjectMatterRecord | null;
  factor?: RatingFactor | null;
}

export interface SubjectMatterFactorValuePayload {
  subject_matter_id: string;
  factor_id: string;
  value_text?: string | null;
  value_number?: number | string | null;
  value_date?: string | null;
  value_boolean?: boolean | null;
  value_json?: Record<string, unknown> | null;
}

export interface NonMotorQuotationDetailRecord {
  id: string;
  quotation_id: string;
  quotation_risk_id: string;
  subject_matter_id: string;
  cover_description: string | null;
  risk_location: string | null;
  insured_value: string | null;
  limit_of_liability: string | null;
  tiramis_payload: Record<string, unknown> | null;
  tiramis_submission_tracking_id: string | null;
  tiramis_status: string | null;
  tiramis_transaction_id: string | null;
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
  created_at: string;
  updated_at: string;
  quotation?: QuotationOption | null;
  quotation_risk?: CustomerRiskOption | null;
  subject_matter?: SubjectMatterRecord | null;
}

export interface NonMotorQuotationDetailPayload {
  quotation_id: string;
  quotation_risk_id: string;
  subject_matter_id: string;
  cover_description?: string | null;
  risk_location?: string | null;
  insured_value?: number | string | null;
  limit_of_liability?: number | string | null;
}

export interface NonMotorPolicyDetailRecord {
  id: string;
  policy_id: string;
  policy_risk_id: string;
  subject_matter_id: string;
  cover_description: string | null;
  risk_location: string | null;
  insured_value: string | null;
  limit_of_liability: string | null;
  tiramis_payload: Record<string, unknown> | null;
  tiramis_submission_tracking_id: string | null;
  tiramis_status: string | null;
  tiramis_transaction_id: string | null;
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
  created_at: string;
  updated_at: string;
  policy?: PolicyOption | null;
  policy_risk?: PolicyRiskOption | null;
  subject_matter?: SubjectMatterRecord | null;
}

export interface NonMotorPolicyDetailPayload {
  policy_id: string;
  policy_risk_id: string;
  subject_matter_id: string;
  cover_description?: string | null;
  risk_location?: string | null;
  insured_value?: number | string | null;
  limit_of_liability?: number | string | null;
}

export interface NamedOption {
  value: string;
  label: string;
}
