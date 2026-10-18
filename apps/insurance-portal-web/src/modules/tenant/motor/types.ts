import type { SortOrder } from '@/types';

export type MotorStatus = string;

export interface MotorCustomerOption {
  id: string;
  customer_no: string;
  customer_type: 'INDIVIDUAL' | 'CORPORATE';
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  company_name: string | null;
  phone: string;
  email: string | null;
}

export interface MotorVehicleRecord {
  id: string;
  company_id: string;
  customer_id: string;
  registration_no: string | null;
  chassis_no: string | null;
  engine_no: string | null;
  make: string | null;
  model: string | null;
  body_type: string | null;
  color: string | null;
  manufacture_year: number | null;
  usage_type: string | null;
  vehicle_category: string | null;
  seating_capacity: number | null;
  tonnage: string | null;
  cubic_capacity: number | null;
  fuel_type: string | null;
  model_no: string | null;
  number_of_axles: number | null;
  axle_distance: string | null;
  tare_weight: string | null;
  gross_weight: string | null;
  motor_category: number | null;
  motor_type: number | null;
  motor_usage: number | null;
  owner_name: string | null;
  owner_category: number | null;
  owner_address: string | null;
  vehicle_value: string;
  currency: string;
  status: string;
  is_verified: boolean;
  verification_status: string;
  verification_source: string | null;
  tira_request_id: string | null;
  tira_response_id: string | null;
  last_verified_at: string | null;
  tira_vehicle_reference: string | null;
  verification_error: string | null;
  metadata: Record<string, unknown> | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  customer?: MotorCustomerOption | null;
  ownership_history?: Array<{
    id: string;
    owner_customer_id: string;
    effective_from: string;
    effective_to: string | null;
    change_reason: string | null;
    owner_customer?: MotorCustomerOption | null;
  }>;
  versions?: MotorVehicleVersionRecord[];
}

export interface MotorVehicleVersionRecord {
  id: string;
  company_id: string;
  motor_vehicle_id: string;
  version_number: number;
  is_current_version: boolean;
  vehicle_snapshot: Record<string, unknown>;
  vehicle_snapshot_hash: string;
  created_by: string | null;
  created_at: string;
}

export interface MotorVehicleAuditLogRecord {
  id: string;
  company_id: string;
  motor_vehicle_id: string;
  motor_vehicle_version_id: string | null;
  customer_id: string | null;
  action: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  fields_changed: string[] | null;
  user_id: string | null;
  source: string;
  related_record_type: string | null;
  related_record_id: string | null;
  created_at: string;
}

export interface MotorVehicleInsuranceHistory {
  policies: MotorPolicyDetailRecord[];
  fleet_items: MotorFleetItemRecord[];
}

export interface MotorFleetRecord {
  id: string;
  company_id: string;
  customer_id: string;
  quotation_id: string | null;
  policy_id: string | null;
  fleet_no: string;
  fleet_name: string | null;
  total_vehicles: number;
  total_sum_insured: string;
  total_premium: string;
  status: string;
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
  deleted_at: string | null;
  customer?: MotorCustomerOption | null;
  quotation?: { id: string; quotation_no: string; status: string } | null;
  /** Only present on the single-fleet GET (findFleet joins it); absent on list responses. */
  items?: MotorFleetItemRecord[];
}

export interface MotorFleetItemRecord {
  id: string;
  fleet_id: string;
  motor_vehicle_id: string;
  quotation_risk_id: string | null;
  policy_risk_id: string | null;
  sum_insured: string;
  premium: string;
  status: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  motor_vehicle?: MotorVehicleRecord | null;
}

export interface MotorQuotationDetailRecord {
  id: string;
  quotation_id: string;
  quotation_risk_id: string;
  motor_vehicle_id: string;
  cover_type: string | null;
  usage_type: string | null;
  no_claim_discount_rate: string | null;
  no_claim_discount_amount: string | null;
  excess_applicable: boolean;
  excess_type: string | null;
  excess_rate: string | null;
  excess_amount: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  quotation?: { id: string; quotation_no: string; status: string } | null;
  motor_vehicle?: MotorVehicleRecord | null;
}

export interface MotorPolicyDetailRecord {
  id: string;
  policy_id: string;
  policy_risk_id: string;
  motor_vehicle_id: string;
  cover_type: string | null;
  usage_type: string | null;
  certificate_no: string | null;
  sticker_no: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  policy?: { id: string; policy_no: string; policy_status: string } | null;
  motor_vehicle?: MotorVehicleRecord | null;
}

/** Summary row from `GET /tenant/motor/vehicles/search` (chassis masked). */
export interface MotorVehicleSearchResult {
  id: string;
  registration_no: string | null;
  chassis_no_masked: string | null;
  make: string | null;
  model: string | null;
  manufacture_year: number | null;
  motor_category: number | null;
  motor_type: number | null;
  customer: { id: string; customer_no: string; name: string } | null;
}

export interface MotorListParams {
  page?: number;
  limit?: number;
  search?: string;
  customer_id?: string;
  status?: string;
  motor_category?: string;
  motor_usage?: string;
  verification_status?: string;
  sortBy?: string;
  sortOrder?: SortOrder;
}

export interface MotorVehiclePayload {
  customer_id: string;
  registration_no?: string | null;
  chassis_no?: string | null;
  engine_no?: string | null;
  make?: string | null;
  model?: string | null;
  body_type?: string | null;
  color?: string | null;
  manufacture_year?: number | null;
  usage_type?: string | null;
  vehicle_category?: string | null;
  seating_capacity?: number | null;
  tonnage?: number | string | null;
  cubic_capacity?: number | null;
  fuel_type?: string | null;
  model_no?: string | null;
  number_of_axles?: number | null;
  axle_distance?: number | string | null;
  tare_weight?: number | string | null;
  gross_weight?: number | string | null;
  motor_category?: number | null;
  motor_type?: number | null;
  motor_usage?: number | null;
  owner_name?: string | null;
  owner_category?: number | null;
  owner_address?: string | null;
  vehicle_value?: number | string | null;
  currency?: string;
  status?: string;
  metadata?: Record<string, unknown> | null;
}

export interface MotorFleetPayload {
  customer_id: string;
  quotation_id?: string | null;
  policy_id?: string | null;
  fleet_no: string;
  fleet_name?: string | null;
  total_vehicles?: number;
  total_sum_insured?: number | string | null;
  total_premium?: number | string | null;
  status?: string;
}

export interface MotorFleetItemPayload {
  motor_vehicle_id: string;
  quotation_risk_id?: string | null;
  policy_risk_id?: string | null;
  sum_insured?: number | string | null;
  premium?: number | string | null;
  status?: string;
}

export interface MotorQuotationDetailPayload {
  quotation_id: string;
  quotation_risk_id: string;
  motor_vehicle_id: string;
  cover_type?: string | null;
  usage_type?: string | null;
  no_claim_discount_rate?: number | string | null;
  no_claim_discount_amount?: number | string | null;
  excess_applicable?: boolean;
  excess_type?: string | null;
  excess_rate?: number | string | null;
  excess_amount?: number | string | null;
}

export interface MotorPolicyDetailPayload {
  policy_id: string;
  policy_risk_id: string;
  motor_vehicle_id: string;
  cover_type?: string | null;
  usage_type?: string | null;
  certificate_no?: string | null;
  sticker_no?: string | null;
}

export interface QuotationOption {
  id: string;
  quotation_no: string;
  status: string;
  customer?: MotorCustomerOption | null;
}

export interface PolicyOption {
  id: string;
  policy_no: string;
  policy_status: string;
  customer?: MotorCustomerOption | null;
}

export interface PolicyRiskOption {
  id: string;
  policy_id: string;
  risk_id: string;
  risk?: { id: string; risk_code: string; risk_name: string } | null;
}

export interface CustomerRiskOption {
  id: string;
  quotation_id: string;
  risk_id: string;
  risk?: { id: string; risk_code: string; risk_name: string } | null;
}
