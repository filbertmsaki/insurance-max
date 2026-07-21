import type { PaginatedResponse } from '@/modules/shared/api/pagination';
import type { CustomerFormValues } from '@/modules/tenant/customers/types';
import type { SortOrder } from '@/types';

export type QuotationType = 'MOTOR' | 'NON_MOTOR';
export type QuotationFlow = 'NON_MOTOR' | 'MOTOR_SINGLE' | 'MOTOR_FLEET';
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

export interface InternalQuotationPayload {
  insurer_company_id: string;
  intermediary_company_id: string | null;
  branch_id: string | null;
  department_id: string | null;
  category_id: string;
  product_id: string;
  sub_class_id: string | null;
  quotation_type: QuotationType;
  quotation_flow: QuotationFlow;
  channel_type: ProductChannelType;
  is_fleet: boolean;
}

export interface CoverNoteHeaderPayload {
  cover_note_type: number;
}

export interface QuotationTaxPayload {
  tax_code: string;
  is_tax_exempted: 'Y' | 'N';
  tax_exemption_type: string | null;
  tax_exemption_reference: string | null;
  tax_rate: number;
  tax_amount: number;
}

export interface QuotationDiscountPayload {
  discount_type: number;
  discount_rate: number;
  discount_amount: number;
}

export interface QuotationRiskCoveredPayload {
  risk_code: string;
  sum_insured: number;
  sum_insured_equivalent: number;
  premium_rate: number;
  premium_before_discount: number;
  premium_after_discount: number;
  premium_excluding_tax_equivalent: number;
  premium_including_tax: number;
  discounts_offered: QuotationDiscountPayload[];
  taxes_charged: QuotationTaxPayload[];
}

export interface QuotationSubjectMatterPayload {
  subject_matter_reference: string;
  subject_matter_desc: string;
}

export interface QuotationAddonPayload {
  addon_reference: string;
  addon_desc: string;
  addon_amount: number;
  addon_premium_rate: number;
  premium_excluding_tax: number;
  premium_excluding_tax_equivalent: number;
  premium_including_tax: number;
  taxes_charged: QuotationTaxPayload[];
}

export interface QuotationPolicyHolderPayload {
  policy_holder_name: string;
  policy_holder_birth_date: string;
  policy_holder_type: number;
  policy_holder_id_number: string;
  policy_holder_id_type: number;
  gender: 'M' | 'F' | null;
  country_code: string;
  region: string;
  district: string;
  street: string | null;
  policy_holder_phone_number: string;
  policy_holder_fax: string | null;
  postal_address: string | null;
  email_address: string | null;
}

export interface QuotationMotorDetailPayload {
  motor_category: number;
  motor_type: number;
  registration_number: string;
  chassis_number: string;
  make: string;
  model: string;
  model_number: string | null;
  body_type: string;
  color: string;
  engine_number: string;
  engine_capacity: string;
  fuel_used: string;
  number_of_axles: number;
  axle_distance: number;
  sitting_capacity: number;
  year_of_manufacture: number;
  tare_weight: number;
  gross_weight: number;
  motor_usage: number;
  owner_name: string;
  owner_category: number;
  owner_address: string;
}

export interface FleetHeaderPayload {
  fleet_id: string;
  fleet_type: number;
  fleet_size: number;
  comprehensive_insured: number;
  sale_point_code: string;
  cover_note_start_date: string;
  cover_note_end_date: string;
  payment_mode: number;
  currency_code: string;
  exchange_rate: number;
  total_premium_excluding_tax: number;
  total_premium_including_tax: number;
  commision_paid: number;
  commision_rate: number;
  officer_name: string;
  officer_title: string;
  product_code: string;
  policy_holders: QuotationPolicyHolderPayload[];
}

export interface FleetDetailPayload {
  fleet_entry: number;
  cover_note_number: string;
  prev_cover_note_reference_number: string | null;
  cover_note_desc: string;
  operative_clause: string;
  endorsement_type: number | null;
  endorsement_reason: string | null;
  endorsement_premium_earned: number | null;
  risks_covered: QuotationRiskCoveredPayload[];
  subject_matters_covered: QuotationSubjectMatterPayload[];
  cover_note_addons: QuotationAddonPayload[];
  motor_dtl: QuotationMotorDetailPayload;
}

export interface CoverNoteDetailPayload {
  cover_note_number?: string;
  prev_cover_note_reference_number?: string | null;
  sale_point_code?: string;
  cover_note_start_date?: string;
  cover_note_end_date?: string;
  cover_note_desc?: string;
  operative_clause?: string;
  payment_mode?: number;
  currency_code?: string;
  exchange_rate?: number;
  total_premium_excluding_tax?: number;
  total_premium_including_tax?: number;
  commision_paid?: number;
  commision_rate?: number;
  officer_name?: string;
  officer_title?: string;
  product_code?: string;
  endorsement_type?: number | null;
  endorsement_reason?: string | null;
  endorsement_premium_earned?: number | null;
  risks_covered?: QuotationRiskCoveredPayload[];
  subject_matters_covered?: QuotationSubjectMatterPayload[];
  cover_note_addons?: QuotationAddonPayload[];
  policy_holders?: QuotationPolicyHolderPayload[];
  motor_dtl?: QuotationMotorDetailPayload;
  fleet_hdr?: FleetHeaderPayload;
  fleet_dtls?: FleetDetailPayload[];
}

export interface QuotationPayload {
  internal_quotation: InternalQuotationPayload;
  cover_note_hdr: CoverNoteHeaderPayload;
  cover_note_dtl: CoverNoteDetailPayload;
}

export interface QuotationListItem {
  id: string;
  quotation_no: string;
  quotation_type: QuotationType;
  quotation_flow: QuotationFlow;
  channel_type: ProductChannelType;
  status: QuotationStatus;
  is_fleet: boolean;
  fleet_id: string | null;
  currency_code: string;
  product_code: string;
  cover_note_start_date: string;
  cover_note_end_date: string;
  total_premium_excluding_tax: number;
  total_premium_including_tax: number;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuotationDetailRecord extends QuotationPayload {
  id: string;
  quotation_no: string;
  status: QuotationStatus;
  submitted_by: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuotationRiskRecord {
  id: string;
  risk_id?: string | null;
  rate?: string | number | null;
  sum_insured?: string | number | null;
  total_premium?: string | number | null;
  risk?: {
    id?: string;
    risk_name?: string | null;
    risk_code?: string | null;
  } | null;
  motor_vehicle?: {
    id?: string;
    registration_no?: string | null;
    chassis_no?: string | null;
    engine_no?: string | null;
  } | null;
}

export interface QuotationPremiumBreakdownRecord {
  id: string;
  item_type?: string | null;
  item_code?: string | null;
  item_name?: string | null;
  amount?: string | number | null;
}

export interface QuotationStatusHistoryRecord {
  id: string;
  old_status: string | null;
  new_status: string;
  reason: string | null;
  created_at: string;
}

export type QuotationRecord = QuotationDetailRecord & {
  customer_id?: string;
  customer?: unknown;
  product?: unknown;
  category?: unknown;
  sub_class?: unknown;
  risks?: QuotationRiskRecord[];
  premium_breakdowns?: QuotationPremiumBreakdownRecord[];
  status_history?: QuotationStatusHistoryRecord[];
};

export interface QuotationSubmitResponse {
  quotation_id: string;
  quotation_no: string;
  request_type: string;
  submitted_at: string;
  submission: {
    id: string;
    [key: string]: unknown;
  };
}

export interface QuotationListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: QuotationStatus;
  quotation_type?: QuotationType;
  quotation_flow?: QuotationFlow;
  product_id?: string;
  sortBy?: string;
  sortOrder?: SortOrder;
}

export interface QuotationWizardRiskDiscountRow {
  discount_type: string;
  discount_rate: string;
  discount_amount: string;
}

export interface QuotationWizardRiskTaxRow {
  tax_code: string;
  is_tax_exempted: boolean;
  tax_exemption_type: string;
  tax_exemption_reference: string;
  tax_rate: string;
  tax_amount: string;
}

export interface QuotationRiskFormRow {
  client_ref: string;
  risk_id: string;
  risk_code: string;
  sum_insured: string;
  sum_insured_equivalent: string;
  premium_rate: string;
  premium_before_discount: string;
  premium_after_discount: string;
  premium_excluding_tax_equivalent: string;
  premium_including_tax: string;
  discounts_offered: QuotationWizardRiskDiscountRow[];
  taxes_charged: QuotationWizardRiskTaxRow[];
  rate: string;
  basic_premium: string;
  discount_amount: string;
  tax_amount: string;
  charges_amount: string;
  commission_amount: string;
  total_premium: string;
  net_premium: string;
  rating_result_metadata: unknown;
}

export interface QuotationWizardAddonTaxRow {
  tax_code: string;
  is_tax_exempted: boolean;
  tax_exemption_type: string;
  tax_exemption_reference: string;
  tax_rate: string;
  tax_amount: string;
}

export interface QuotationWizardAddonRow {
  enabled: boolean;
  addon_reference: string;
  addon_desc: string;
  addon_amount: string;
  addon_premium_rate: string;
  premium_excluding_tax: string;
  premium_excluding_tax_equivalent: string;
  premium_including_tax: string;
  taxes: QuotationWizardAddonTaxRow[];
}

export interface QuotationWizardMotorDetails {
  vehicle_id: string;
  motor_category_code: '' | '1' | '2';
  motor_type_code: '' | '1' | '2';
  registration_no: string;
  chassis_no: string;
  engine_no: string;
  make: string;
  model: string;
  model_no: string;
  body_type: string;
  color: string;
  manufacture_year: string;
  usage_type: string;
  motor_usage_code: '' | '1' | '2';
  vehicle_category: string;
  seating_capacity: string;
  tonnage: string;
  cubic_capacity: string;
  fuel_type: string;
  number_of_axles: string;
  axle_distance: string;
  tare_weight: string;
  gross_weight: string;
  owner_name: string;
  owner_category: '' | '1' | '2';
  owner_address: string;
  vehicle_value: string;
}

export interface QuotationWizardFleetHeader {
  fleet_id: string;
  fleet_no: string;
  fleet_name: string;
  fleet_type: '1' | '2';
  fleet_size: string;
  comprehensive_insured: string;
}

export interface QuotationWizardFleetRiskRow {
  risk_code: string;
  sum_insured: string;
  sum_insured_equivalent: string;
  premium_rate: string;
  premium_before_discount: string;
  premium_after_discount: string;
  premium_excluding_tax_equivalent: string;
  premium_including_tax: string;
  discounts_offered: QuotationWizardRiskDiscountRow[];
  taxes_charged: QuotationWizardRiskTaxRow[];
}

export interface QuotationWizardFleetSubjectMatterRow {
  subject_matter_reference: string;
  subject_matter_desc: string;
}

export interface QuotationWizardFleetAddonRow {
  addon_reference: string;
  addon_desc: string;
  addon_amount: string;
  addon_premium_rate: string;
  premium_excluding_tax: string;
  premium_excluding_tax_equivalent: string;
  premium_including_tax: string;
  taxes: QuotationWizardAddonTaxRow[];
}

export interface QuotationWizardFleetMotorDetails {
  motor_category: string;
  motor_type: string;
  registration_number: string;
  chassis_number: string;
  make: string;
  model: string;
  model_number: string;
  body_type: string;
  color: string;
  engine_number: string;
  engine_capacity: string;
  fuel_used: string;
  number_of_axles: string;
  axle_distance: string;
  sitting_capacity: string;
  year_of_manufacture: string;
  tare_weight: string;
  gross_weight: string;
  motor_usage: string;
  owner_name: string;
  owner_category: string;
  owner_address: string;
}

export interface QuotationWizardFleetItemRow {
  vehicle_id: string;
  fleet_item_id: string;
  registration_no: string;
  chassis_no: string;
  make: string;
  model: string;
  model_no: string;
  body_type: string;
  color: string;
  engine_no: string;
  engine_capacity: string;
  fuel_used: string;
  number_of_axles: string;
  axle_distance: string;
  manufacture_year: string;
  seating_capacity: string;
  tare_weight: string;
  gross_weight: string;
  motor_category_code: '' | '1' | '2';
  motor_type_code: '' | '1' | '2';
  motor_usage_code: '' | '1' | '2';
  owner_name: string;
  owner_category: '' | '1' | '2';
  owner_address: string;
  vehicle_value: string;
  sum_insured: string;
  premium: string;
  fleet_entry: string;
  cover_note_number: string;
  prev_cover_note_reference_number: string;
  cover_note_desc: string;
  operative_clause: string;
  endorsement_type: '1' | '2' | '3' | '4' | '';
  endorsement_reason: string;
  endorsement_premium_earned: string;
  risks_covered: QuotationWizardFleetRiskRow[];
  subject_matters_covered: QuotationWizardFleetSubjectMatterRow[];
  cover_note_addons: QuotationWizardFleetAddonRow[];
  motor_dtl: QuotationWizardFleetMotorDetails;
}

export interface QuotationWizardNonMotorItemRow {
  subject_matter_reference: string;
  subject_matter_desc: string;
}

export interface QuotationFormValues {
  insurer_company_id: string;
  intermediary_company_id: string;
  branch_id: string;
  department_id: string;
  policyholder_mode: 'existing' | 'new';
  customer_id: string;
  policyholder: CustomerFormValues;
  category_id: string;
  product_id: string;
  sub_class_id: string;
  quotation_flow: QuotationFlow;
  quotation_type: QuotationType;
  is_fleet: boolean;
  channel_type: ProductChannelType;
  status: QuotationStatus;
  currency: string;
  exchange_rate: string;
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
  sale_point_id: string;
  cover_note_type: '1' | '2' | '3';
  prev_cover_note_reference: string;
  endorsement_type: '1' | '2' | '3' | '4' | '';
  endorsement_reason: string;
  endorsement_premium_earned: string;
  officer_name: string;
  officer_title: string;
  payment_mode_tira: '1' | '2' | '3';
  risks: QuotationRiskFormRow[];
  addons: QuotationWizardAddonRow[];
  motor_mode: 'existing' | 'new';
  motor: QuotationWizardMotorDetails;
  fleet: {
    header: QuotationWizardFleetHeader;
    items: QuotationWizardFleetItemRow[];
  };
  nonMotor: {
    items: QuotationWizardNonMotorItemRow[];
  };
}

export type QuotationPage = PaginatedResponse<QuotationListItem>;
