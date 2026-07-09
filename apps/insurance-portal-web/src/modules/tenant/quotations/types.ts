import type { PaginatedResponse } from '@/modules/shared/api/pagination';
import type { CustomerFormValues, CustomerRecord } from '@/modules/tenant/customers/types';
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
  /** 'existing' selects a saved Customer via customer_id; 'new' fills `policyholder` inline. */
  policyholder_mode: 'existing' | 'new';
  customer_id: string;
  policyholder: CustomerFormValues;
  category_id: string;
  product_id: string;
  sub_class_id: string;
  risks: QuotationRiskFormRow[];
  addons: QuotationWizardAddonRow[];
  /** 'existing' selects a saved MotorVehicle via motor.vehicle_id; 'new' fills `motor` inline. */
  motor_mode: 'existing' | 'new';
  motor: QuotationWizardMotorDetails;
  fleet: {
    header: QuotationWizardFleetHeader;
    items: QuotationWizardFleetItemRow[];
  };
  nonMotor: {
    items: QuotationWizardNonMotorItemRow[];
  };
  quotation_type: QuotationType;
  /**
   * Client-only flag: true when the Motor quotation represents a fleet submission.
   * Not persisted on the Quotation entity yet (see wizard Phase-0 backend gap #5) —
   * drives which wizard step (Motor vs Motor Fleet) is shown and how the TIRA
   * payload is built, but is stripped out of the create/update payload.
   */
  is_fleet: boolean;
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
  /** Wizard-local: TIRAMIS sale point to submit this cover note under. */
  sale_point_id: string;
  /** Wizard-local: exchange rate against the quotation currency (TIRA payload only). */
  exchange_rate: string;
  /** Wizard-local, TIRA CoverNoteHdr/CoverNoteDtl fields — not Quotation columns. */
  cover_note_type: '1' | '2' | '3';
  prev_cover_note_reference: string;
  officer_name: string;
  officer_title: string;
  payment_mode_tira: '1' | '2' | '3';
}

/** One repeatable risk row in the wizard's Risk & Premium step (Phase 5). */
export interface QuotationRiskFormRow {
  risk_id: string;
  subject_matter_id: string;
  motor_vehicle_id: string;
  sum_insured: string;
  factor_values: Record<string, string | number | boolean>;
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

/**
 * One tax charged against a cover note add-on. Mirrors TIRA's
 * `CreateCoverNoteAddonDto.taxes[]` / `TaxCharged` shape exactly (tax code,
 * exemption flag/type/reference, rate) — client-only, computed at TIRA
 * submission time (Phase 13), never persisted on the Quotation.
 */
export interface QuotationWizardAddonTaxRow {
  tax_code: string;
  is_tax_exempted: boolean;
  tax_exemption_type: string;
  tax_exemption_reference: string;
  tax_rate: string;
}

/**
 * One cover note add-on (Phase 6). There is no backend entity for add-ons —
 * they are collected here purely to be carried through to the TIRA
 * `CoverNoteAddons` payload at submission time; disabled rows are excluded
 * from that payload rather than sent as inactive line items.
 */
export interface QuotationWizardAddonRow {
  enabled: boolean;
  addon_reference: string;
  addon_desc: string;
  addon_amount: string;
  addon_premium_rate: string;
  premium_excluding_tax: string;
  taxes: QuotationWizardAddonTaxRow[];
}

/**
 * Motor Details (Phase 7). Mirrors `CreateMotorVehicleDto` field-for-field —
 * there is no owner_name/owner_category/owner_address on MotorVehicle (confirmed
 * absent from the entity/DTO/frontend types); vehicle ownership is purely the
 * `customer_id` FK, so this wizard reuses the already-selected policyholder
 * (Step 2) as the vehicle's customer rather than capturing owner fields here.
 */
export interface QuotationWizardMotorDetails {
  vehicle_id: string;
  registration_no: string;
  chassis_no: string;
  engine_no: string;
  make: string;
  model: string;
  body_type: string;
  color: string;
  manufacture_year: string;
  usage_type: string;
  vehicle_category: string;
  seating_capacity: string;
  tonnage: string;
  cubic_capacity: string;
  fuel_type: string;
  vehicle_value: string;
}

/**
 * Motor Fleet header (Phase 8, Step 5B). Mirrors `CreateMotorFleetDto` plus the
 * TIRA `FleetHdr` fields that have no backend column (fleet_type/comprehensive
 * insured count are TIRA-payload-only, carried forward to Phase 13).
 */
export interface QuotationWizardFleetHeader {
  /** Set once the MotorFleet record has been created/updated. */
  fleet_id: string;
  fleet_no: string;
  fleet_name: string;
  /** TIRA FleetType: '1' New, '2' Addition. */
  fleet_type: '1' | '2';
  comprehensive_insured: string;
}

/**
 * One vehicle row in the fleet table. Each row always creates/updates its own
 * MotorVehicle (fleet onboarding is typically all-new vehicles, unlike the
 * single-vehicle Motor step which offers an existing-vehicle picker) plus a
 * MotorFleetItem linking that vehicle to the fleet with its own sum
 * insured/premium. quotation_risk_id is intentionally left unset — attributing
 * a specific risk row to a specific fleet vehicle has the same correlation gap
 * already flagged for multi-risk factor_values (see schemas.ts buildQuotationPayload).
 */
export interface QuotationWizardFleetItemRow {
  vehicle_id: string;
  fleet_item_id: string;
  registration_no: string;
  chassis_no: string;
  make: string;
  model: string;
  manufacture_year: string;
  seating_capacity: string;
  vehicle_value: string;
  sum_insured: string;
  premium: string;
}

/**
 * One subject matter row in the Non-Motor step (Phase 9). SubjectMatter is a
 * standalone catalog entity (customer_id FK only, no quotation link) — each
 * row here always creates a new one owned by the policyholder. The link to
 * this specific quotation happens via a NonMotorQuotationDetail row, which
 * *requires* a `quotation_risk_id` — there's no "unlinked" subject matter
 * detail. Rows are matched 1:1 by index to the Risk & Premium step's risk
 * rows (row 0 -> risks[0], etc.), so the count here is capped at
 * `risks.length` and detail creation must wait until the quotation has been
 * saved at least once (risk rows have no real id before that).
 */
export interface QuotationWizardNonMotorItemRow {
  subject_matter_id: string;
  detail_id: string;
  subject_type: string;
  subject_code: string;
  description: string;
  location: string;
  value: string;
  cover_description: string;
  risk_location: string;
  insured_value: string;
  limit_of_liability: string;
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

