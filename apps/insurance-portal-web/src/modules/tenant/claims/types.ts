/** Money values travel as decimal strings; the API may also return numbers. */
export type Money = string | number | null | undefined;

export type ClaimStatus =
  | 'DRAFT'
  | 'NOTIFICATION_SUBMITTED'
  | 'NOTIFICATION_FAILED'
  | 'NOTIFICATION_ACCEPTED'
  | 'INTIMATION_PENDING'
  | 'INTIMATION_SUBMITTED'
  | 'INTIMATION_FAILED'
  | 'INTIMATED'
  | 'ASSESSMENT_PENDING'
  | 'UNDER_ASSESSMENT'
  | 'ASSESSED'
  | 'REASSESSMENT_REQUIRED'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'DISCHARGE_PENDING'
  | 'DISCHARGE_ISSUED'
  | 'DISCHARGE_ACCEPTED'
  | 'DISCHARGE_REJECTED'
  | 'PAYMENT_PENDING'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'SETTLED'
  | 'REJECTION_PENDING'
  | 'REJECTED'
  | 'REOPENED'
  | 'CLOSED'
  | 'CANCELLED';

export type ClaimQueue =
  | 'notification'
  | 'intimation'
  | 'assessment'
  | 'discharge'
  | 'payment'
  | 'rejection';

export type ClaimAllowedAction =
  | 'edit'
  | 'delete'
  | 'submit_notification'
  | 'retry_notification'
  | 'create_intimation'
  | 'submit_intimation'
  | 'create_assessment'
  | 'create_discharge'
  | 'create_payment'
  | 'reject'
  | 'close'
  | 'reopen';

export type ClaimPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type NotificationSource =
  | 'WALK_IN'
  | 'PHONE'
  | 'EMAIL'
  | 'PORTAL'
  | 'INTERMEDIARY'
  | 'OTHER';
export type BusinessLine = 'MOTOR' | 'FLEET' | 'NON_MOTOR';
export type ClaimantType =
  | 'POLICYHOLDER'
  | 'INSURED'
  | 'BENEFICIARY'
  | 'THIRD_PARTY'
  | 'SERVICE_PROVIDER'
  | 'OTHER';

// ---------------------------------------------------------------------------
// Policy lookup
// ---------------------------------------------------------------------------

export interface PolicyLookupResult {
  id: string;
  policy_no: string | null;
  cover_note_no: string | null;
  policy_reference_number: string | null;
  policy_status: string | null;
  start_date: string | null;
  end_date: string | null;
  currency: string | null;
  business_line: BusinessLine | null;
  customer_name: string | null;
}

export interface PolicyLookupVehicle {
  id: string;
  registration_no: string | null;
  chassis_no: string | null;
  make: string | null;
  model: string | null;
  body_type: string | null;
  manufacture_year: number | string | null;
  usage_type: string | null;
  vehicle_value: Money;
}

export interface PolicyLookupRisk {
  id: string;
  risk_name: string | null;
  risk_code: string | null;
  sum_insured: Money;
  status: string | null;
  subject_matter: { id: string; description: string | null } | null;
  vehicle: PolicyLookupVehicle | null;
  cover_note_reference_number: string | null;
}

export interface PolicyLookupCustomer {
  id: string;
  customer_no: string | null;
  name: string | null;
  customer_type: string | null;
  phone: string | null;
  email: string | null;
  region: string | null;
  district: string | null;
}

export interface PolicyLookupDetail extends PolicyLookupResult {
  sum_insured: Money;
  total_premium: Money;
  product_id: string | null;
  category_id: string | null;
  branch_id: string | null;
  open_claims: number;
  customer: PolicyLookupCustomer | null;
  risks: PolicyLookupRisk[];
}

// ---------------------------------------------------------------------------
// Claim and child records
// ---------------------------------------------------------------------------

export interface ClaimUserRef {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}

export interface ClaimBranchRef {
  id: string;
  name?: string | null;
  code?: string | null;
}

export interface ClaimCustomerRef {
  id?: string;
  customer_no?: string | null;
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
  display_name?: string | null;
  full_name?: string | null;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface ClaimPolicyRef {
  id: string;
  policy_no?: string | null;
  cover_note_no?: string | null;
  policy_reference_number?: string | null;
  cover_note_reference_number?: string | null;
  policy_status?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  cover_note_start_date?: string | null;
  cover_note_end_date?: string | null;
  currency_code?: string | null;
  business_line?: string | null;
  sum_insured?: Money;
  total_premium?: Money;
  product?: { id: string; name?: string | null } | null;
}

export interface ClaimPolicyRiskRef {
  id: string;
  sum_insured?: Money;
  cover_note_reference_number?: string | null;
  risk?: {
    id: string;
    name?: string | null;
    code?: string | null;
    risk_name?: string | null;
    risk_code?: string | null;
  } | null;
  motor_vehicle?: Partial<PolicyLookupVehicle> | null;
}

export interface ClaimClaimant {
  id: string;
  claimant_type: ClaimantType | string;
  is_primary?: boolean;
  uses_policyholder?: boolean;
  full_name: string | null;
  claimant_category: number | null;
  party_type: number | null;
  id_type: number | null;
  identification_number: string | null;
  birth_date: string | null;
  gender: string | null;
  country_code: string | null;
  region: string | null;
  district: string | null;
  street: string | null;
  phone: string | null;
  fax: string | null;
  postal_address: string | null;
  email: string | null;
  amount_claimed?: Money;
  amount_approved?: Money;
  amount_paid?: Money;
  status?: string | null;
}

export interface ClaimDocumentRecord {
  id: string;
  document_id: string | null;
  document_type: string;
  title: string | null;
  file_name?: string | null;
  mime_type?: string | null;
  file_size?: number | null;
  status: 'UPLOADED' | 'VERIFIED' | 'REJECTED' | string;
  uploaded_by?: string | null;
  uploaded_at?: string | null;
  verified_by?: string | null;
  verified_at?: string | null;
  rejection_reason?: string | null;
  metadata?: Record<string, unknown> | null;
  claim_id?: string;
  claim?: { id: string; claim_no?: string | null } | null;
}

export interface ClaimDocumentRequirementStatus {
  id: string;
  claim_stage: string;
  document_type: string;
  title: string;
  is_mandatory: boolean;
  satisfied: boolean;
  verified: boolean;
}

export interface ClaimDocumentsView {
  documents: ClaimDocumentRecord[];
  requirements: ClaimDocumentRequirementStatus[];
}

export interface ClaimReserve {
  id: string;
  reserve_no?: string | null;
  /** INITIAL | INCREASE | DECREASE | ASSESSMENT_ADJUSTMENT | CLOSURE_ADJUSTMENT... */
  reserve_type: string;
  /** Signed: decreases and releases are negative. */
  amount: Money;
  currency?: string | null;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'RELEASED' | string;
  reason?: string | null;
  effective_at?: string | null;
  created_by?: string | null;
  submitted_at?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  rejected_by?: string | null;
  rejection_reason?: string | null;
  released_by?: string | null;
  released_at?: string | null;
  release_reason?: string | null;
  created_at?: string | null;
}

export interface ClaimIntimation {
  id: string;
  claim_intimation_number: string | null;
  claim_reference_number?: string | null;
  claim_intimation_date?: string | null;
  currency_code?: string | null;
  exchange_rate?: Money;
  claim_estimated_amount?: Money;
  claim_reserve_amount?: Money;
  claim_reserve_method?: string | null;
  loss_assessment_option?: number | null;
  assessor_name?: string | null;
  assessor_id_number?: string | null;
  assessor_id_type?: number | null;
  status: 'DRAFT' | 'SUBMITTED' | 'ACCEPTED' | 'FAILED' | string;
  tiramis_status?: string | null;
  created_by?: string | null;
  submitted_by?: string | null;
  submitted_at?: string | null;
  created_at?: string | null;
}

export interface ClaimAssessment {
  id: string;
  claim_assessment_number: string | null;
  is_re_assessment?: 'Y' | 'N' | string | null;
  status:
    | 'DRAFT'
    | 'SUBMITTED'
    | 'APPROVED'
    | 'REJECTED'
    | 'SUPERSEDED'
    | string;
  assessment_received_date?: string | null;
  assessment_report_summary?: string | null;
  assessment_amount?: Money;
  approved_claim_amount?: Money;
  recommended_amount?: Money;
  deductible_amount?: Money;
  salvage_amount?: Money;
  contribution_amount?: Money;
  betterment_amount?: Money;
  recovery_amount?: Money;
  assessor_name?: string | null;
  assessor_company?: string | null;
  inspection_date?: string | null;
  remarks?: string | null;
  claim_intimation_number?: string | null;
  claim_approval_date?: string | null;
  claim_approval_authority?: string | null;
  currency_code?: string | null;
  supersedes_assessment_id?: string | null;
  created_by?: string | null;
  submitted_by?: string | null;
  submitted_at?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  rejected_by?: string | null;
  rejected_at?: string | null;
  rejection_reason?: string | null;
  tiramis_status?: string | null;
  created_at?: string | null;
}

export interface ClaimDischargeVoucher {
  id: string;
  discharge_voucher_number: string | null;
  version?: number | null;
  status:
    | 'DRAFT'
    | 'SUBMITTED'
    | 'APPROVED'
    | 'SENT_TO_CLAIMANT'
    | 'ACCEPTED'
    | 'REJECTED'
    | 'CANCELLED'
    | string;
  claim_offer_amount?: Money;
  claimant_id?: string | null;
  claim_offer_communication_date?: string | null;
  offer_accepted?: boolean | string | null;
  claimant_response_date?: string | null;
  adjustment_date?: string | null;
  adjustment_reason?: string | null;
  adjustment_amount?: Money;
  reconciliation_date?: string | null;
  reconciliation_summary?: string | null;
  reconciled_amount?: Money;
  claim_assessment_number?: string | null;
  assessment_id?: string | null;
  discharge_voucher_date?: string | null;
  currency_code?: string | null;
  signed_document_id?: string | null;
  generated_document_id?: string | null;
  supersedes_voucher_id?: string | null;
  created_by?: string | null;
  submitted_by?: string | null;
  submitted_at?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  rejected_by?: string | null;
  rejection_reason?: string | null;
  tiramis_status?: string | null;
  created_at?: string | null;
}

export interface ClaimPayment {
  id: string;
  claim_payment_number: string | null;
  status:
    | 'DRAFT'
    | 'SUBMITTED'
    | 'APPROVED'
    | 'PROCESSING'
    | 'PAID'
    | 'FAILED'
    | 'REVERSED'
    | 'CANCELLED'
    | string;
  paid_amount?: Money;
  payment_mode?: number | null;
  payment_method?: string | null;
  payment_reference?: string | null;
  payee_type?: string | null;
  payee_name?: string | null;
  finance_disbursement_id?: string | null;
  finance_status?: string | null;
  payment_date?: string | null;
  claimant_id?: string | null;
  discharge_voucher_id?: string | null;
  parties_notified?: 'Y' | 'N' | string | null;
  claim_resulted_litigation?: 'Y' | 'N' | string | null;
  litigation_reason?: string | null;
  net_premium_earned?: Money;
  currency_code?: string | null;
  payee_snapshot?: {
    name?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null;
  /** Account numbers are masked by the API. */
  payee_bank_details?: Record<string, unknown> | null;
  created_by?: string | null;
  submitted_by?: string | null;
  submitted_at?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  paid_by?: string | null;
  paid_at?: string | null;
  rejection_reason?: string | null;
  tiramis_status?: string | null;
  created_at?: string | null;
}

export interface ClaimDisbursement {
  id: string;
  claim_payment_id: string;
  disbursement_no: string;
  status: 'REQUESTED' | 'PROCESSING' | 'PAID' | 'FAILED' | 'REVERSED' | string;
  amount: Money;
  currency_code: string | null;
  payment_method?: string | null;
  provider_reference?: string | null;
  requested_by?: string | null;
  requested_at?: string | null;
  confirmed_by?: string | null;
  confirmed_at?: string | null;
  failed_at?: string | null;
  failure_message?: string | null;
}

export interface ClaimRejection {
  id: string;
  claim_rejection_number: string | null;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'CANCELLED' | string;
  rejection_reason?: string | null;
  tira_rejection_reason?: string | null;
  recommendation?: string | null;
  policy_clause_reference?: string | null;
  claim_amount?: Money;
  currency_code?: string | null;
  claim_resulted_litigation?: 'Y' | 'N' | null;
  /** Set only when the claim was intimated; TIRA needs it (§14.1). */
  claim_intimation_number?: string | null;
  claim_reference_number?: string | null;
  rejection_date?: string | null;
  letter_document_id?: string | null;
  previous_claim_status?: string | null;
  tiramis_status?: string | null;
  created_by?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  created_at?: string | null;
}

export interface ClaimApproval {
  id: string;
  subject_type: string;
  subject_id: string;
  approval_type: string;
  round: number;
  level: number;
  required_levels: number;
  amount: Money;
  currency_code: string | null;
  status:
    | 'PENDING'
    | 'APPROVED'
    | 'REJECTED'
    | 'RETURNED'
    | 'SUPERSEDED'
    | string;
  comments: string | null;
  submitted_by: string | null;
  submitted_at?: string | null;
  acted_by: string | null;
  acted_at: string | null;
  admin_override: boolean | null;
  created_at?: string | null;
}

export type ClaimRegulatoryOperationType =
  | 'NOTIFICATION'
  | 'INTIMATION'
  | 'ASSESSMENT'
  | 'DISCHARGE_VOUCHER'
  | 'PAYMENT'
  | 'REJECTION';

export interface ClaimRegulatoryOperation {
  id: string;
  operation_type: ClaimRegulatoryOperationType | string;
  source_record_id: string | null;
  source_record_number: string | null;
  sequence_number: number | null;
  status: string;
  regulatory_reference: string | null;
  acknowledgement_code: string | null;
  acknowledgement_message: string | null;
  final_response_code: string | null;
  final_response_message: string | null;
  submitted_at: string | null;
  completed_at: string | null;
  request_snapshot?: unknown;
  response_snapshot?: unknown;
}

export interface ClaimTimelineEvent {
  id: string;
  event_type: string;
  actor_type: 'USER' | 'SYSTEM' | 'TIRA' | string;
  actor_name: string | null;
  previous_status: string | null;
  new_status: string | null;
  subject_type: string | null;
  summary: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface ClaimListItem {
  id: string;
  claim_no: string;
  claim_notification_number?: string | null;
  claim_reference_number?: string | null;
  cover_note_reference_number?: string | null;
  claim_title?: string | null;
  status: ClaimStatus;
  tiramis_status?: string | null;
  priority?: ClaimPriority | null;
  loss_date?: string | null;
  loss_type?: string | null;
  loss_nature?: string | null;
  currency_code?: string | null;
  estimated_amount?: Money;
  approved_amount?: Money;
  paid_amount?: Money;
  policy?: ClaimPolicyRef | null;
  customer?: ClaimCustomerRef | null;
  assigned_user?: ClaimUserRef | null;
  branch?: ClaimBranchRef | null;
  created_at?: string | null;
}

export interface ClaimDetail extends ClaimListItem {
  claim_report_date?: string | null;
  loss_location?: string | null;
  description?: string | null;
  cause_of_loss?: string | null;
  police_report_number?: string | null;
  incident_details?: Record<string, unknown> | null;
  reporter_name?: string | null;
  reporter_phone?: string | null;
  reporter_email?: string | null;
  notification_source?: NotificationSource | string | null;
  /** Stored as the TIRAMIS Y/N flag. */
  claim_form_dully_filled?: 'Y' | 'N' | boolean | null;
  internal_notes?: string | null;
  officer_title?: string | null;
  possible_duplicate_of_id?: string | null;
  duplicate_override_reason?: string | null;
  claim_stage?: string | null;
  liability_status?: string | null;
  settlement_status?: string | null;
  coverage_status?: string | null;
  exchange_rate?: Money;
  outstanding_reserve?: Money;
  gross_case_reserve?: Money;
  outstanding_amount?: Money;
  officer_name?: string | null;
  policy_id?: string;
  policy_risk_id?: string | null;
  assigned_user_id?: string | null;
  policy_risk?: ClaimPolicyRiskRef | null;
  claimants?: ClaimClaimant[];
  documents?: ClaimDocumentRecord[];
  reserves?: ClaimReserve[];
  assessments?: ClaimAssessment[];
  payments?: ClaimPayment[];
  intimations?: ClaimIntimation[];
  discharge_vouchers?: ClaimDischargeVoucher[];
  disbursements?: ClaimDisbursement[];
  rejections?: ClaimRejection[];
  approvals?: ClaimApproval[];
  regulatory_operations?: ClaimRegulatoryOperation[];
  allowed_actions?: ClaimAllowedAction[];
  allowed_transitions?: string[];
  /** Display names of the users referenced on this claim's records, by id. */
  user_names?: Record<string, string>;
}

export type ClaimRecoveryType =
  | 'REINSURANCE'
  | 'SUBROGATION'
  | 'SALVAGE'
  | 'CONTRIBUTION'
  | 'OTHER';

export type ClaimRecoveryStatus =
  | 'EXPECTED'
  | 'REQUESTED'
  | 'PARTIALLY_RECEIVED'
  | 'RECEIVED'
  | 'WRITTEN_OFF'
  | 'CANCELLED';

export interface ClaimRecovery {
  id: string;
  company_id: string;
  claim_id: string;
  recovery_no: string;
  recovery_type: ClaimRecoveryType;
  expected_amount: string;
  received_amount: string;
  status: ClaimRecoveryStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClaimSubmissionResult {
  operationId: string;
  trackingId: string | null;
  status: string | null;
  claim: ClaimDetail;
}

// ---------------------------------------------------------------------------
// Payloads
// ---------------------------------------------------------------------------

export interface ClaimListParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  status?: string;
  queue?: ClaimQueue;
  branch_id?: string;
  product_id?: string;
  category_id?: string;
  assigned_user_id?: string;
  policy_id?: string;
  from?: string;
  to?: string;
}

export interface ClaimantPayload {
  claimant_type: ClaimantType;
  uses_policyholder?: boolean;
  is_primary?: boolean;
  full_name?: string;
  claimant_category?: number;
  party_type?: number;
  id_type?: number;
  identification_number?: string;
  birth_date?: string;
  gender?: 'M' | 'F';
  country_code?: string;
  region?: string;
  district?: string;
  street?: string;
  phone?: string;
  fax?: string;
  postal_address?: string;
  email?: string;
  amount_claimed?: string;
}

export interface ClaimIncidentPayload {
  loss_date: string;
  claim_report_date?: string;
  loss_nature: string;
  loss_type: string;
  loss_location: string;
  description: string;
  claim_title?: string;
  cause_of_loss?: string;
  police_report_number?: string;
  estimated_amount?: string;
  priority?: ClaimPriority;
  claim_form_dully_filled?: boolean;
  notification_source?: NotificationSource;
  reporter_name?: string;
  reporter_phone?: string;
  reporter_email?: string;
  incident_details?: Record<string, unknown>;
  internal_notes?: string;
}

export interface CreateClaimPayload extends ClaimIncidentPayload {
  policy_id: string;
  policy_risk_id?: string;
  assigned_user_id?: string;
  department_id?: string;
  claimants: ClaimantPayload[];
  duplicate_override_reason?: string;
}

export interface IntimationPayload {
  claim_reserve_amount: string;
  claim_reserve_method: string;
  claim_estimated_amount?: string;
  claim_intimation_date?: string;
  exchange_rate?: string;
  loss_assessment_option: number;
  assessor_name: string;
  assessor_id_number: string;
  assessor_id_type: number;
  assessor_user_id?: string;
  assessor_company_id?: string;
}

export interface ReservePayload {
  reserve_type: 'INITIAL' | 'INCREASE' | 'DECREASE';
  amount: string;
  reason: string;
}

export interface AssessmentPayload {
  assessment_received_date: string;
  assessment_report_summary: string;
  assessment_amount: string;
  approved_claim_amount: string;
  service_assignment_id?: string;
  assessor_name?: string;
  assessor_company?: string;
  inspection_date?: string;
  recommended_amount?: string;
  deductible_amount?: string;
  salvage_amount?: string;
  contribution_amount?: string;
  betterment_amount?: string;
  recovery_amount?: string;
  remarks?: string;
}

export interface VoucherPayload {
  claim_offer_amount: string;
  claimant_id?: string;
  claim_offer_communication_date?: string;
}

export interface VoucherResponsePayload {
  response: 'ACCEPT' | 'REJECT';
  claimant_response_date?: string;
  signed_document_id?: string;
  reason?: string;
}

export interface VoucherAdjustPayload {
  adjustment_date?: string;
  adjustment_reason?: string;
  adjustment_amount?: string;
  reconciliation_date?: string;
  reconciliation_summary?: string;
  reconciled_amount?: string;
}

export interface PaymentPayload {
  paid_amount: string;
  payment_mode: number;
  discharge_voucher_id?: string;
  claimant_id?: string;
  payment_method?: string;
  payment_reference?: string;
  payee_type?: 'CLAIMANT' | 'GARAGE' | 'HOSPITAL' | 'ASSESSOR' | 'OTHER';
  payee_name?: string;
  payee_bank_details?: {
    bank_name?: string;
    account_name?: string;
    account_number?: string;
  };
  parties_notified?: 'Y' | 'N';
  claim_resulted_litigation?: boolean;
  litigation_reason?: string;
}

export interface RejectionPayload {
  rejection_reason: string;
  tira_rejection_reason: string;
  recommendation?: string;
  policy_clause_reference?: string;
  claim_resulted_litigation?: boolean;
  claim_amount?: string;
}

export interface DeclinePayload {
  comments: string;
  decision?: 'REJECT' | 'RETURN';
}

export interface UploadSessionPayload {
  document_type: string;
  title: string;
  claim_stage?: string;
  requirement_code?: string;
}

// ---------------------------------------------------------------------------
// Dashboard and configuration
// ---------------------------------------------------------------------------

export interface ClaimsDashboardBreakdown {
  label: string;
  claims: number;
  approved?: Money;
  paid?: Money;
}

export interface ClaimsDashboardSummary {
  counts: {
    total: number;
    open: number;
    newly_reported: number;
    notification: number;
    pending_intimation: number;
    under_assessment: number;
    pending_approval: number;
    pending_approval_items: number;
    pending_discharge: number;
    pending_payment: number;
    partially_paid: number;
    paid: number;
    settled: number;
    rejected: number;
    closed: number;
  };
  amounts: {
    reserve: Money;
    approved: Money;
    paid: Money;
    outstanding: Money;
  };
  by_status: Array<{ status: string; count: number }>;
  by_product: ClaimsDashboardBreakdown[];
  by_class: ClaimsDashboardBreakdown[];
  by_branch: ClaimsDashboardBreakdown[];
  by_month: Array<{ month: string; claims: number; paid?: Money }>;
  tira: {
    accepted: number;
    pending: number;
    failed: number;
    reconciliation_required: number;
  };
}

export interface ClaimsDashboardParams {
  from?: string;
  to?: string;
  branch_id?: string;
  product_id?: string;
}

export type ApprovalType =
  | 'RESERVE'
  | 'ASSESSMENT'
  | 'DECISION'
  | 'DISCHARGE'
  | 'PAYMENT'
  | 'REJECTION';

export interface ApprovalLimit {
  id: string;
  approval_type: ApprovalType;
  level: number;
  role_id: string | null;
  user_id: string | null;
  insurance_category_id: string | null;
  product_id: string | null;
  branch_id: string | null;
  min_amount: Money;
  max_amount: Money;
  currency_code: string | null;
  is_active: boolean;
  description: string | null;
  role?: { id: string; name?: string; display_name?: string } | null;
  user?: ClaimUserRef | null;
  branch?: ClaimBranchRef | null;
}

export interface ApprovalLimitPayload {
  id?: string;
  approval_type: ApprovalType;
  level: number;
  role_id?: string | null;
  user_id?: string | null;
  insurance_category_id?: string | null;
  product_id?: string | null;
  branch_id?: string | null;
  min_amount: string;
  max_amount?: string | null;
  currency_code?: string;
  is_active?: boolean;
  description?: string;
}

export type ClaimDocumentStage =
  | 'NOTIFICATION'
  | 'INTIMATION'
  | 'ASSESSMENT'
  | 'DISCHARGE'
  | 'PAYMENT'
  | 'REJECTION';

export interface DocumentRequirement {
  id: string;
  claim_stage: ClaimDocumentStage;
  document_type: string;
  title: string;
  description: string | null;
  is_mandatory: boolean;
  sort_order: number | null;
  product_id: string | null;
  insurance_category_id: string | null;
  is_active: boolean;
}

export interface DocumentRequirementPayload {
  id?: string;
  claim_stage: ClaimDocumentStage;
  document_type: string;
  title: string;
  description?: string;
  is_mandatory?: boolean;
  sort_order?: number;
  product_id?: string | null;
  insurance_category_id?: string | null;
  is_active?: boolean;
}

export interface ClaimNumberFormat {
  document_type: string;
  label: string;
  default_prefix: string;
  prefix: string;
  sequence_length: number;
  customised: boolean;
  example: string;
  updated_at: string | null;
}

export interface ClaimNumberFormatPayload {
  document_type: string;
  prefix: string;
  sequence_length: number;
}
