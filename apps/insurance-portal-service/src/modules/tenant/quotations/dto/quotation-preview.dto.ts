export interface QuotationPreviewRef {
  id?: string | null;
  code?: string | null;
  name?: string | null;
  description?: string | null;
}

export interface QuotationPreviewValueSource {
  value: string | number | boolean | null;
  source: 'stored' | 'calculated' | 'derived';
}

export interface QuotationPreviewOverview {
  quotation_id: string;
  quotation_no: string;
  quotation_type: string;
  quotation_flow: string;
  quotation_status: string;
  channel_type: string;
  company: QuotationPreviewRef;
  branch: QuotationPreviewRef;
  department: QuotationPreviewRef;
  product: QuotationPreviewRef;
  insurance_category: QuotationPreviewRef & { business_line?: string | null };
  subclass: QuotationPreviewRef;
  sales_point: QuotationPreviewRef;
  created_by: QuotationPreviewRef;
  updated_by: QuotationPreviewRef;
  submitted_by: QuotationPreviewRef;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
}

export interface QuotationPreviewCoverNote {
  cover_note_type: number | null;
  cover_note_number: string | null;
  previous_cover_note_reference_number: string | null;
  cover_note_start_date: string | null;
  cover_note_end_date: string | null;
  cover_note_description: string | null;
  operative_clause: string | null;
  payment_mode: number | null;
  currency: string | null;
  exchange_rate: number | null;
  product_code: string | null;
  authorizing_officer_name: string | null;
  authorizing_officer_title: string | null;
  commission_rate: number | null;
  commission_paid: number | null;
  endorsement_type: number | null;
  endorsement_reason: string | null;
  endorsement_premium_earned: number | null;
  fleet_id: string | null;
  fleet_type: number | null;
  fleet_size: number | null;
  comprehensive_insured: number | null;
  sale_point_code: string | null;
}

export interface QuotationPreviewPremiumSummary {
  total_sum_insured: number | null;
  total_premium_before_discount: number | null;
  total_discount_amount: number | null;
  total_premium_after_discount: number | null;
  total_premium_excluding_tax: number | null;
  total_tax_amount: number | null;
  total_premium_including_tax: number | null;
  equivalent_premium_excluding_tax: number | null;
  equivalent_premium_including_tax: number | null;
  currency: string | null;
  exchange_rate: number | null;
}

export interface QuotationPreviewPolicyholder {
  policyholder_type: string | number | null;
  full_name: string | null;
  date_of_birth: string | null;
  identification_type: string | number | null;
  identification_number: string | null;
  gender: string | null;
  country: string | null;
  region: string | null;
  district: string | null;
  street: string | null;
  phone_number: string | null;
  fax_number: string | null;
  postal_address: string | null;
  email_address: string | null;
}

export interface QuotationPreviewTax {
  tax_code: string | null;
  tax_name: string | null;
  tax_rate: number | null;
  tax_amount: number | null;
  is_tax_exempted: boolean;
  tax_exemption_type: string | null;
  tax_exemption_reference: string | null;
}

export interface QuotationPreviewDiscount {
  discount_type: string | number | null;
  discount_label: string | null;
  discount_rate: number | null;
  discount_amount: number | null;
}

export interface QuotationPreviewRisk {
  risk_number: number | null;
  risk_code: string | null;
  risk_name: string | null;
  sum_insured: number | null;
  sum_insured_equivalent: number | null;
  premium_rate: number | null;
  premium_before_discount: number | null;
  premium_after_discount: number | null;
  premium_excluding_tax_equivalent: number | null;
  premium_including_tax: number | null;
  discounts: QuotationPreviewDiscount[];
  taxes: QuotationPreviewTax[];
}

export interface QuotationPreviewSubjectMatter {
  subject_matter_reference: string | null;
  subject_matter_description: string | null;
  related_risk_code: string | null;
}

export interface QuotationPreviewAddon {
  addon_reference: string | null;
  addon_description: string | null;
  insured_amount: number | null;
  premium_rate: number | null;
  premium_excluding_tax: number | null;
  premium_excluding_tax_equivalent: number | null;
  premium_including_tax: number | null;
  taxes: QuotationPreviewTax[];
}

export interface QuotationPreviewMotorDetails {
  motor_category: string | number | null;
  motor_type: string | number | null;
  registration_number: string | null;
  chassis_number: string | null;
  make: string | null;
  model: string | null;
  model_number: string | null;
  body_type: string | null;
  colour: string | null;
  engine_number: string | null;
  engine_capacity: string | number | null;
  fuel_used: string | null;
  number_of_axles: number | null;
  axle_distance: number | null;
  seating_capacity: number | null;
  year_of_manufacture: number | null;
  tare_weight: number | null;
  gross_weight: number | null;
  motor_usage: string | number | null;
  owner_name: string | null;
  owner_category: string | number | null;
  owner_address: string | null;
}

export interface QuotationPreviewFleetVehicle {
  fleet_entry_number: number | null;
  cover_note_number: string | null;
  previous_cover_note_reference_number: string | null;
  cover_note_description: string | null;
  operative_clause: string | null;
  endorsement_type: number | null;
  endorsement_reason: string | null;
  endorsement_premium_earned: number | null;
  risks: QuotationPreviewRisk[];
  subject_matters: QuotationPreviewSubjectMatter[];
  addons: QuotationPreviewAddon[];
  motor_details: QuotationPreviewMotorDetails | null;
  tiramis: QuotationPreviewTiramisSubmission | null;
}

export interface QuotationPreviewFleetHeader {
  fleet_id: string | null;
  fleet_type: number | null;
  fleet_type_label: string | null;
  fleet_size: number | null;
  comprehensive_insured: number | null;
  cover_note_type: number | null;
  sales_point_code: string | null;
  cover_start_date: string | null;
  cover_end_date: string | null;
  payment_mode: number | null;
  currency: string | null;
  exchange_rate: number | null;
  product_code: string | null;
  commission_rate: number | null;
  commission_paid: number | null;
  authorizing_officer_name: string | null;
  authorizing_officer_title: string | null;
  total_premium_excluding_tax: number | null;
  total_premium_including_tax: number | null;
  policyholders: QuotationPreviewPolicyholder[];
}

export interface QuotationPreviewFleetSummary {
  declared_fleet_size: number | null;
  saved_vehicle_count: number;
  comprehensive_vehicle_count: number;
  third_party_vehicle_count: number;
  total_fleet_sum_insured: number;
  total_risk_premium: number;
  total_addon_premium: number;
  total_discounts: number;
  total_taxes: number;
  total_premium_excluding_tax: number;
  total_premium_including_tax: number;
  successful_entries: number;
  failed_entries: number;
  pending_entries: number;
}

export interface QuotationPreviewPayment {
  payment_status: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  receipt_number: string | null;
  amount_paid: number | null;
  payment_date: string | null;
  currency: string | null;
  outstanding_amount: number | null;
  verification_status: string | null;
  invoice_number: string | null;
}

export interface QuotationPreviewTiramisSubmission {
  source: 'quotation' | 'vehicle' | 'fleet';
  submission_status: string | null;
  request_id: string | null;
  submission_attempt_number: number | null;
  date_submitted: string | null;
  submitted_by: string | null;
  tiramis_environment: string | null;
  last_submission_error: string | null;
  next_retry_time: string | null;
  acknowledgement_id: string | null;
  acknowledgement_status_code: string | null;
  acknowledgement_status_description: string | null;
  acknowledgement_received_date: string | null;
  callback_received_status: string | null;
  callback_received_date: string | null;
  response_id: string | null;
  response_status_code: string | null;
  response_status_description: string | null;
  cover_note_reference_number: string | null;
  sticker_number: string | null;
}

export interface QuotationPreviewHistoryItem {
  action: string;
  previous_status: string | null;
  new_status: string | null;
  performed_by: string | null;
  date_time: string | null;
  remarks: string | null;
}

export interface QuotationPreviewResponse {
  overview: QuotationPreviewOverview;
  cover_note: QuotationPreviewCoverNote;
  premium_summary: QuotationPreviewPremiumSummary;
  policyholders: QuotationPreviewPolicyholder[];
  risks: QuotationPreviewRisk[];
  subject_matters: QuotationPreviewSubjectMatter[];
  addons: QuotationPreviewAddon[];
  motor_details: QuotationPreviewMotorDetails | null;
  fleet: {
    header: QuotationPreviewFleetHeader;
    summary: QuotationPreviewFleetSummary;
    vehicles: QuotationPreviewFleetVehicle[];
  } | null;
  payment: QuotationPreviewPayment | null;
  tiramis: QuotationPreviewTiramisSubmission | null;
  history: QuotationPreviewHistoryItem[];
}
