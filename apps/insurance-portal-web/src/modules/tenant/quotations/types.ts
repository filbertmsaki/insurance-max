import type { PaginatedResponse } from '@/modules/shared/api/pagination';
import type { CustomerFormValues } from '@/modules/tenant/customers/types';
import type { PricingQuoteMetadata } from '@/modules/pricing';
import type { SortOrder } from '@/types';

export type QuotationType = 'MOTOR' | 'NON_MOTOR';
export type QuotationFlow = 'NON_MOTOR' | 'MOTOR_SINGLE' | 'MOTOR_FLEET';
export type QuotationStatus =
  | 'DRAFT'
  | 'PENDING_REQUIREMENTS'
  | 'READY_FOR_SUBMISSION'
  | 'SUBMITTING_TO_TIRA'
  | 'SUBMITTED_TO_TIRA'
  | 'TIRA_PROCESSING'
  | 'COMPLETED'
  | 'REJECTED'
  | 'FAILED'
  | 'EXPIRED'
  | 'CANCELLED';
export type ApprovalStatus =
  | 'NOT_REQUIRED'
  | 'NOT_SUBMITTED'
  | 'PENDING'
  | 'APPROVED'
  | 'CHANGES_REQUESTED'
  | 'REJECTED'
  | 'CANCELLED';
export type PremiumOverrideStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';
export type PaymentStatus =
  | 'NOT_REQUIRED'
  | 'NOT_INITIATED'
  | 'REQUESTED'
  | 'PROCESSING'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'FAILED'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'REFUNDED';
export type TiraStatus =
  | 'NOT_SUBMITTED'
  | 'SUBMITTING'
  | 'SUBMITTED'
  | 'PROCESSING'
  | 'SUCCESS'
  | 'ENDORSED'
  | 'CANCELLED'
  | 'REJECTED'
  | 'FAILED';
export type QuotationDisplayStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'CHANGES_REQUESTED'
  | 'APPROVAL_REJECTED'
  | 'PAYMENT_REQUIRED'
  | 'AWAITING_PAYMENT'
  | 'PAYMENT_PROCESSING'
  | 'PARTIALLY_PAID'
  | 'PAYMENT_FAILED'
  | 'PAYMENT_REQUEST_EXPIRED'
  | 'READY_FOR_TIRA_SUBMISSION'
  | 'SUBMITTING_TO_TIRAMIS'
  | 'SUBMITTED_TO_TIRAMIS'
  | 'PROCESSING_AT_TIRAMIS'
  | 'REJECTED_BY_TIRAMIS'
  | 'TIRAMIS_SUBMISSION_FAILED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'EXPIRED';
export type QuotationStatusTransitionAction =
  | 'EVALUATE_REQUIREMENTS'
  | 'SUBMIT_FOR_APPROVAL'
  | 'APPROVE'
  | 'REQUEST_CHANGES'
  | 'REJECT_APPROVAL'
  | 'MARK_PAYMENT_REQUESTED'
  | 'MARK_PAYMENT_PROCESSING'
  | 'MARK_PARTIALLY_PAID'
  | 'MARK_PAYMENT_PAID'
  | 'MARK_PAYMENT_FAILED'
  | 'MARK_PAYMENT_EXPIRED'
  | 'MARK_PAYMENT_REFUNDED'
  | 'CANCEL'
  | 'EXPIRE'
  | 'CONVERT';
export type ProductChannelType =
  | 'DIRECT'
  | 'BROKER'
  | 'AGENCY'
  | 'BANCASSURANCE'
  | 'API';
export type QuotationStage =
  | 'DRAFT'
  | 'COMPLETED'
  | 'SUBMISSION_PROCESSING'
  | 'SUBMITTED'
  | 'CANCELLED'
  | 'EXPIRED';
export type QuotationApprovalStatusV2 =
  | 'NOT_EVALUATED'
  | 'NOT_REQUIRED'
  | 'PENDING'
  | 'APPROVED'
  | 'CHANGES_REQUESTED'
  | 'REJECTED'
  | 'CANCELLED';
export type QuotationPaymentStatusV2 =
  | 'NOT_EVALUATED'
  | 'NOT_REQUIRED'
  | 'NOT_REQUESTED'
  | 'REQUESTED'
  | 'PROCESSING'
  | 'PARTIAL'
  | 'PAID'
  | 'FAILED'
  | 'REFUNDED'
  | 'CANCELLED';
export type QuotationSubmissionStatusV2 =
  | 'NOT_READY'
  | 'READY'
  | 'QUEUED'
  | 'PROCESSING'
  | 'ACKNOWLEDGED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'FAILED'
  | 'RETRYABLE'
  | 'RETRY_EXHAUSTED'
  | 'CANCELLED';
export type QuotationWorkflowCommand =
  | 'SAVE_DRAFT'
  | 'SAVE_AND_CONTINUE'
  | 'COMPLETE'
  | 'SUBMIT_APPROVAL'
  | 'APPROVE'
  | 'REQUEST_CHANGES'
  | 'REJECT'
  | 'REQUEST_PAYMENT'
  | 'SUBMIT_TIRAMIS'
  | 'RETRY_TIRAMIS'
  | 'CANCEL'
  | 'DELETE'
  | 'REFRESH_CUSTOMER'
  | 'REFRESH_ASSET'
  | 'RECALCULATE';

export interface InternalQuotationPayload {
  insurer_company_id: string;
  intermediary_company_id: string | null;
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
  request_reason_code?: string | null;
  request_comment?: string | null;
  effective_from?: string | null;
  effective_to?: string | null;
  requested_by?: string | null;
  requested_at?: string | null;
  max_permitted_rate?: number | null;
  max_permitted_amount?: number | null;
  approval_required?: boolean | null;
  approval_status?: 'NOT_REQUIRED' | 'PENDING' | 'APPROVED' | 'REJECTED' | null;
  approved_rate?: number | null;
  approved_amount?: number | null;
  approved_by?: string | null;
  approval_date?: string | null;
  rejection_reason?: string | null;
}

export interface QuotationRiskCoveredPayload {
  risk_code: string;
  pricing_quote_id?: string | null;
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
  cover_note_number?: string;
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
  quotation_status: QuotationStatus;
  approval_status: ApprovalStatus;
  payment_status: PaymentStatus;
  tira_status: TiraStatus;
  display_status: QuotationDisplayStatus;
  display_label: string;
  requires_approval: boolean;
  requires_payment: boolean;
  is_fleet: boolean;
  source_policy_transaction_id: string | null;
  source_policy_id: string | null;
  previous_quotation_id: string | null;
  fleet_id: string | null;
  currency_code: string;
  product_code: string;
  product_name: string | null;
  customer_name: string | null;
  vehicle_registration_number: string | null;
  vehicle_chassis_number: string | null;
  cover_note_start_date: string;
  cover_note_end_date: string;
  total_premium_excluding_tax: number;
  total_premium_including_tax: number;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuotationDetailRecord extends Omit<
  QuotationPayload,
  'internal_quotation' | 'cover_note_dtl'
> {
  internal_quotation: InternalQuotationPayload & { branch_id: string | null };
  cover_note_dtl: CoverNoteDetailPayload & {
    fleet_hdr?: FleetHeaderPayload & { sale_point_code?: string };
  };
  id: string;
  quotation_no: string;
  customer_id?: string | null;
  status: QuotationStatus;
  quotation_status: QuotationStatus;
  approval_status: ApprovalStatus;
  payment_status: PaymentStatus;
  tira_status: TiraStatus;
  display_status: QuotationDisplayStatus;
  display_label: string;
  requires_approval: boolean;
  requires_payment: boolean;
  submitted_by: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
  current_wizard_step?: string | null;
  draft_payload?: Record<string, unknown> | null;
  cancellation_reason?: string | null;
  pricing_integration?: QuotationPricingIntegration | null;
}

export interface QuotationDraftRecordPayload {
  insurer_company_id?: string | null;
  intermediary_company_id?: string | null;
  department_id?: string | null;
  customer_id?: string | null;
  sub_class_id?: string | null;
  category_id: string;
  product_id: string;
  quotation_type: QuotationType;
  quotation_flow: QuotationFlow;
  channel_type: ProductChannelType;
  is_fleet: boolean;
  current_wizard_step?: string | null;
  draft_payload: Record<string, unknown>;
}

export interface QuotationPricingIntegration {
  pricing_status: 'CURRENT' | 'STALE' | 'EXPIRED' | 'MISSING';
  is_stale: boolean;
  current_pricing_quote_id: string | null;
  pricing_quote_ids: string[];
  last_calculated_at: string | null;
  pricing_expires_at: string | null;
  rate_book_version: string | null;
  base_premium: number;
  total_discounts: number;
  total_loadings: number;
  total_taxes: number;
  final_payable_premium: number;
  override_status: string;
  approval_status: string;
  stale_reasons: string[];
}

export interface QuotationPreviewRef {
  id?: string | null;
  code?: string | null;
  name?: string | null;
  description?: string | null;
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

export interface QuotationPreviewPremiumOverride {
  id: string;
  sequence_no: number | null;
  original_calculated_premium: number | null;
  proposed_premium: number | null;
  difference_amount: number | null;
  difference_percentage: number | null;
  override_reason: string | null;
  supporting_notes: string | null;
  requested_by: QuotationPreviewRef;
  requested_at: string | null;
  approval_status: PremiumOverrideStatus;
  approved_by: QuotationPreviewRef;
  approved_at: string | null;
  rejection_reason: string | null;
}

export interface QuotationPreviewRisk {
  risk_id: string;
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
  premium_overrides: QuotationPreviewPremiumOverride[];
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
  quotation_payment_status: PaymentStatus | null;
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

export interface QuotationPreviewRecord {
  overview: {
    quotation_id: string;
    quotation_no: string;
    quotation_type: QuotationType;
    quotation_flow: QuotationFlow;
    quotation_status: QuotationStatus;
    approval_status: ApprovalStatus;
    payment_status: PaymentStatus;
    tira_status: TiraStatus;
    display_status: QuotationDisplayStatus;
    display_label: string;
    requires_approval: boolean;
    requires_payment: boolean;
    channel_type: ProductChannelType;
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
  };
  cover_note: {
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
  };
  premium_summary: {
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
  };
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
  pricing_integration?: QuotationPricingIntegration | null;
}

export interface QuotationWorkflowBlockingReason {
  code: string;
  message: string;
  field?: string | null;
}

export interface QuotationWorkflowView {
  quotationId: string;
  quotationNumber: string;
  workflowRevision: number;
  quotationStage: QuotationStage;
  approval: {
    required: boolean;
    status: QuotationApprovalStatusV2;
    assignedToUserId?: string | null;
    submittedAt?: string | null;
    decidedAt?: string | null;
    comments?: string | null;
    reason?: string | null;
  };
  payment: {
    required: boolean;
    status: QuotationPaymentStatusV2;
    mode?: 'INVOICE' | 'DIRECT' | 'CREDIT' | null;
    reference?: string | null;
    requestedAt?: string | null;
    completedAt?: string | null;
    failureReason?: string | null;
  };
  submission: {
    status: QuotationSubmissionStatusV2;
    requestId?: string | null;
    responseId?: string | null;
    submittedAt?: string | null;
    acknowledgedAt?: string | null;
    acceptedAt?: string | null;
    failureReason?: string | null;
  };
  finalizationHash?: string | null;
  workflowGateHash?: string | null;
  completedAt?: string | null;
  blockingReasons: QuotationWorkflowBlockingReason[];
  availableCommands: Partial<Record<QuotationWorkflowCommand, boolean>>;
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
    id?: string | null;
    localTrackingId?: string | null;
    localStatus?: string | null;
    [key: string]: unknown;
  };
}

export interface TransitionQuotationStatusPayload {
  action: QuotationStatusTransitionAction;
  reason?: string;
  comments?: string;
  request_id?: string;
  payment_transaction_id?: string;
  tira_request_id?: string;
  tira_response_id?: string;
  metadata?: Record<string, unknown>;
}

export interface RequestQuotationPremiumOverridePayload {
  proposed_premium: number;
  override_reason: string;
  supporting_notes?: string;
}

export interface DecideQuotationPremiumOverridePayload {
  rejection_reason?: string;
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
  request_reason_code: string;
  request_comment: string;
  effective_from: string;
  effective_to: string;
  requested_by: string;
  requested_at: string;
  max_permitted_rate: string;
  max_permitted_amount: string;
  approval_required: boolean;
  approval_status: string;
  approved_rate: string;
  approved_amount: string;
  approved_by: string;
  approval_date: string;
  rejection_reason: string;
}

export interface QuotationWizardRiskTaxRow {
  tax_code: string;
  is_tax_exempted: boolean;
  tax_exemption_type: string;
  tax_exemption_reference: string;
  tax_rate: string;
  tax_amount: string;
}

export type QuotationRiskRatingMetadata = PricingQuoteMetadata;

export interface QuotationRiskFormRow {
  client_ref: string;
  risk_id: string;
  risk_code: string;
  factor_values: Record<string, string | number | boolean>;
  sum_insured: string;
  sum_insured_equivalent: string;
  premium_rate: string;
  premium_before_discount: string;
  premium_after_discount: string;
  premium_excluding_tax_equivalent: string;
  premium_including_tax: string;
  minimum_amount: string;
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
  rating_result_metadata: QuotationRiskRatingMetadata | null;
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
  addon_definition_id: string;
  addon_quantity: string;
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
  client_ref: string;
  risk_id: string;
  risk_code: string;
  factor_values: Record<string, string | number | boolean>;
  sum_insured: string;
  sum_insured_equivalent: string;
  premium_rate: string;
  premium_before_discount: string;
  premium_after_discount: string;
  premium_excluding_tax_equivalent: string;
  premium_including_tax: string;
  discounts_offered: QuotationWizardRiskDiscountRow[];
  taxes_charged: QuotationWizardRiskTaxRow[];
  rating_result_metadata: QuotationRiskRatingMetadata | null;
}

export interface QuotationWizardFleetSubjectMatterRow {
  subject_matter_reference: string;
  subject_matter_desc: string;
}

/**
 * Same shape as QuotationWizardAddonRow — fleet vehicle add-ons share the
 * non-fleet add-on schema (and AddonRow UI) rather than a reduced one.
 */
export type QuotationWizardFleetAddonRow = QuotationWizardAddonRow;

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
  cover_note_number: string;
  cover_note_desc: string;
  operative_clause: string;
  cover_note_type: '1' | '2' | '3';
  prev_cover_note_reference: string;
  endorsement_type: '1' | '2' | '3' | '4' | '';
  endorsement_reason: string;
  endorsement_premium_earned: string;
  commission_paid: string;
  commission_rate: string;
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
