import type { UnderwriteLine } from '@insurance-max/contracts';

export interface UnderwriteQuotationStats {
  total: number;
  draft: number;
  pending_requirements: number;
  pending_approval: number;
  ready_for_submission: number;
  tira_in_progress: number;
  tira_failed: number;
  completed: number;
}

export interface UnderwritePolicyStats {
  total: number;
  active: number;
  renewals_due: number;
  cancelled: number;
  expired: number;
}

export interface UnderwriteTransactionStats {
  renewals: number;
  endorsements: number;
  cancellations: number;
  tira_pending: number;
}

/** Sections are `null` when the user lacks permission for them. */
export interface UnderwriteLineSummary {
  line: UnderwriteLine;
  quotations: UnderwriteQuotationStats | null;
  policies: UnderwritePolicyStats | null;
  transactions: UnderwriteTransactionStats | null;
  /** FLEET line only. */
  fleet?: UnderwriteFleetStats | null;
  /** NON_MOTOR line only. */
  by_class?: UnderwriteClassStats[] | null;
}

export interface UnderwriteFleetStats {
  active_fleets: number;
  covered_vehicles: number;
}

export interface FleetVehicleRow {
  entry_id: string;
  entry_number: number;
  registration_number: string | null;
  chassis_number: string | null;
  make: string | null;
  model: string | null;
  body_type: string | null;
  year_of_manufacture: number | null;
  risk_codes: string[];
  sum_insured: number;
  premium_excluding_tax: number;
  premium_including_tax: number;
  cover_note_number: string | null;
  cover_note_reference_number: string | null;
  sticker_number: string | null;
  cover_note_status: string | null;
  motor_vehicle_id: string | null;
  fleet_item_id: string | null;
  policy_risk_statuses: string[];
  /** Fleet membership after add/remove-vehicle endorsements. */
  membership_status?: 'ACTIVE' | 'ADDED' | 'CANCELLED';
  added_on?: string | null;
  removed_on?: string | null;
}

export interface FleetSummary {
  fleet_id: string | null;
  fleet_reference: string | null;
  fleet_type: number | null;
  fleet_size: number | null;
  comprehensive_insured: number | null;
  register_fleet_id: string | null;
  register_status: string | null;
  vehicles: FleetVehicleRow[];
  totals: {
    vehicles: number;
    sum_insured: number;
    premium_excluding_tax: number;
    premium_including_tax: number;
    issued_cover_notes: number;
  };
}

export interface UnderwriteClassStats {
  category_id: string | null;
  category_name: string;
  policies: number;
  active: number;
}

export type RiskFieldDataType =
  | 'TEXT'
  | 'TEXTAREA'
  | 'NUMBER'
  | 'INTEGER'
  | 'DECIMAL'
  | 'CURRENCY'
  | 'DATE'
  | 'BOOLEAN'
  | 'SELECT'
  | 'MULTI_SELECT';

export interface RiskFieldOption {
  value: string;
  label: string;
}

export interface RiskFieldValidationRules {
  min?: number;
  max?: number;
  max_length?: number;
  pattern?: string;
}

/** A configured risk field, or its snapshot on a quotation. */
export interface RiskFieldDefinition {
  field_key: string;
  label: string;
  data_type: RiskFieldDataType;
  is_required: boolean;
  options: RiskFieldOption[] | null;
  validation_rules: RiskFieldValidationRules | null;
  section?: string | null;
  help_text?: string | null;
}

export interface ProductRiskField extends RiskFieldDefinition {
  id: string;
  product_id: string;
  sub_class_id: string | null;
  section: string | null;
  sort_order: number;
  help_text: string | null;
  is_active: boolean;
}

export type RiskFieldInput = Omit<
  ProductRiskField,
  'id' | 'product_id' | 'sub_class_id' | 'field_key'
>;

export type RiskDataValue = string | number | boolean | string[] | null;

export interface RiskDetailsView {
  quotation_id: string;
  product_id: string | null;
  sub_class_id: string | null;
  fields: ProductRiskField[];
  risk_data: Record<string, RiskDataValue>;
  risk_location: string | null;
  limit_of_liability: number | null;
  schema_snapshot: RiskFieldDefinition[];
  updated_at: string | null;
}

export interface QuotationDocumentView {
  id: string;
  title: string | null;
  document_type: string | null;
  file_name: string;
  status: string;
  uploaded_at: string;
}

export interface UnderwritePolicyTransactionRow {
  kind: 'endorsement' | 'cancellation';
  id: string;
  transaction_no: string;
  transaction_type: string;
  stage: string;
  approval_status: string;
  payment_status: string;
  submission_status: string;
  source_policy_id: string;
  effective_date: string;
  reason: string;
  premium_effect: string;
  additional_premium: string;
  return_premium: string;
  net_premium_difference: string;
  currency_code: string;
  tiramis_request_id: string | null;
  tiramis_transaction_id: string | null;
  created_at: string;
  updated_at: string;
  policy_no: string;
  cover_note_no: string | null;
  customer_name: string | null;
}

export interface UnderwriteRenewalRow {
  kind: 'renewal';
  id: string;
  renewal_no: string;
  renewal_status: string;
  renewal_start_date: string;
  renewal_end_date: string;
  offer_expires_at: string | null;
  created_at: string;
  policy_transaction: UnderwritePolicyTransactionRow;
}

export interface UnderwriteTiraQueueRow {
  source_kind: 'quotation' | 'policy_transaction';
  id: string;
  reference_no: string;
  workflow_status: string;
  tira_status: string | null;
  tira_request_id: string | null;
  tira_response_id: string | null;
  status_code: string | null;
  status_description: string | null;
  customer_name: string | null;
  updated_at: string;
  transaction_type?: string;
  source_policy_id?: string;
  policy_no?: string;
  cover_note_no?: string | null;
}
