import { ConditionOperator } from '@insurance-max/portal-shared/enums/condition-operator.enum';
import { LogicalOperator } from '@insurance-max/portal-shared/enums/logical-operator.enum';
import { RateType } from '@insurance-max/portal-shared/enums/rate-type.enum';

export type PricingFactorValues = Record<string, string | number | boolean>;

export interface PricingAdjustmentRequestInput {
  rate?: number | null;
  fixed_amount?: number | null;
}

export type PricingAdjustmentType = 'PERCENTAGE' | 'FIXED' | 'NONE';

export interface PricingSingleRiskInput {
  client_reference?: string;
  risk_id: string;
  sum_insured?: number;
  factors: PricingFactorValues;
  factor_values?: PricingFactorValues;
  effective_date?: string;
  quotation_type?: string;
  currency_code?: string;
  exchange_rate?: number;
  discount?: PricingAdjustmentRequestInput | null;
  loading?: PricingAdjustmentRequestInput | null;
  tax_rule_ids?: string[] | null;
}

export interface PricingMultiRiskInput {
  risks: PricingSingleRiskInput[];
  company_user_id?: string;
  branch_id?: string;
  department_id?: string;
  product_code?: string;
  effective_date?: string;
  quotation_type?: string;
  currency_code?: string;
  exchange_rate?: number;
}

export interface PricingQuoteMetadata {
  pricing_quote_id: string;
  pricing_status: 'CALCULATED';
  calculated_at: string;
  expires_at: string;
  input_signature: string;
  quotation_type: string | null;
  currency_code: string | null;
}

export interface PricingAdjustmentControl {
  max_rate: number | null;
  max_amount: number | null;
  approval_threshold_rate: number | null;
  approval_threshold_amount: number | null;
  effective_from: string | null;
  effective_to: string | null;
}

export type PricingChargeCategory =
  | 'TAX'
  | 'LEVY'
  | 'FEE'
  | 'POLICY_FEE'
  | 'STAMP_DUTY'
  | 'ADMINISTRATION_FEE'
  | 'PRODUCT_CHARGE'
  | 'RISK_CHARGE';

export type PricingChargeScope = 'COMPANY' | 'CATEGORY' | 'PRODUCT' | 'RISK';

export type PricingChargeType = 'PERCENTAGE' | 'FIXED';

export type PricingChargeBase =
  | 'BASIC_PREMIUM'
  | 'NET_PREMIUM'
  | 'GROSS_PREMIUM';

export interface PricingChargeBreakdown {
  applied_rule_id: string;
  charge_code: string;
  charge_name: string;
  charge_category: PricingChargeCategory;
  charge_scope: PricingChargeScope;
  charge_type: PricingChargeType;
  calculation_base: PricingChargeBase;
  base_amount: number;
  rate: number | null;
  fixed_amount: number | null;
  minimum_charge_amount: number | null;
  maximum_charge_amount: number | null;
  computed_amount: number;
  is_taxable: boolean;
  effective_from: string;
  effective_to: string;
}

export interface PricingChargeSummary {
  total_charge_amount: number;
  taxable_charge_amount: number;
  non_taxable_charge_amount: number;
  premium_including_charges: number;
}

export interface PricingChargeCalculationInput {
  category_id?: string | null;
  product_id?: string | null;
  risk_id?: string | null;
  effective_date?: string | null;
  basic_premium: number;
  net_premium: number;
  gross_premium: number;
  tax_rule_ids?: string[] | null;
}

export type ExchangeRateSource = 'PARITY' | 'MANUAL';

export interface ExchangeRateSnapshot {
  quotation_currency_code: string;
  base_currency_code: string;
  exchange_rate: number;
  exchange_rate_source: ExchangeRateSource;
  exchange_rate_date: string;
  exchange_rate_precision: number;
  approval_required: boolean;
  approval_granted: boolean;
  approved_by_user_id: string | null;
  approved_at: string | null;
  conversion_direction: 'QUOTE_TO_BASE_MULTIPLY';
  rounding_method: 'ROUND_HALF_UP';
}

export interface PricingBreakdownRateBookSummary {
  code: string | null;
  version: string | null;
}

export interface PricingBreakdownMatchedRuleSummary {
  rule_id: string;
  rule_name: string;
  rule_version: number | null;
}

export interface PricingBreakdownAdjustmentLine {
  code: string;
  name: string;
  amount: number;
  rate: number | null;
}

export interface PricingBreakdownChargeLine {
  charge_code: string;
  charge_name: string;
  charge_category: PricingChargeCategory;
  charge_scope: PricingChargeScope;
  charge_type: PricingChargeType;
  calculation_base: PricingChargeBase;
  base_amount: number;
  rate: number | null;
  amount: number;
  is_taxable: boolean;
}

export interface PricingBreakdownItem {
  client_reference: string | null;
  risk_id: string;
  risk_code: string;
  risk_name: string;
  calculation_method: RateType;
  sum_insured: number;
  rate: number;
  display_rate_percent: number;
  raw_premium: number;
  minimum_premium: number;
  minimum_applied: boolean;
  loadings: PricingBreakdownAdjustmentLine[];
  discounts: PricingBreakdownAdjustmentLine[];
  premium_after_discount: number;
  taxes: PricingBreakdownChargeLine[];
  other_charges: PricingBreakdownChargeLine[];
  final_premium: number;
  matched_rule: PricingBreakdownMatchedRuleSummary;
}

export interface PricingBreakdownTotals {
  base_premium: number;
  raw_premium: number;
  loadings: number;
  discounts: number;
  premium_after_discount: number;
  taxes: number;
  other_charges: number;
  payable_premium: number;
}

export interface PricingBreakdownMessage {
  client_reference: string | null;
  risk_id: string | null;
  risk_code: string | null;
  message: string;
}

export type PricingBreakdownStatus =
  | 'CALCULATED'
  | 'PARTIAL'
  | 'INCOMPLETE';

export interface PricingPremiumBreakdown {
  pricing_quote_id: string;
  status: PricingBreakdownStatus;
  currency: string | null;
  rate_book: PricingBreakdownRateBookSummary;
  items: PricingBreakdownItem[];
  totals: PricingBreakdownTotals;
  errors: PricingBreakdownMessage[];
  warnings: PricingBreakdownMessage[];
  expires_at: string;
}

export interface RiskPremiumResult {
  client_reference?: string | null;
  risk_id: string;
  risk_code: string;
  risk_name: string;
  rate_book_id: string | null;
  rate_book_code: string | null;
  rate_book_version: string | null;
  rule_id: string;
  rule_name: string;
  rule_version: number | null;
  sum_insured: number;
  rate_type: RateType;
  percentage_rate: number;
  base_premium: number;
  per_unit_factor_code: string | null;
  per_unit_value: number;
  per_unit_amount: number;
  per_unit_premium: number;
  fixed_amount: number;
  minimum_amount: number;
  gross_premium: number;
  final_premium: number;
  minimum_applied: boolean;
  discount_control: PricingAdjustmentControl;
  loading_control: PricingAdjustmentControl;
  charges: PricingChargeBreakdown[];
  total_charge_amount: number;
  taxable_charge_amount: number;
  non_taxable_charge_amount: number;
  premium_including_charges: number;
  exchange_rate_snapshot?: ExchangeRateSnapshot | null;
  premium_breakdown?: PricingPremiumBreakdown;
  factors: PricingFactorValues;
  validation_errors: string[];
  validation_warnings: string[];

  // --- Documented calculation-response contract (additive; mirrors the
  // fields above under the names the frontend binds form fields to) ---
  premium_rate: number;
  premium_rate_percent: number;
  raw_premium: number;
  sum_insured_equivalent: number;
  minimum_premium: number;
  minimum_premium_applied: boolean;
  /** Not yet supported: no maximum-premium ceiling exists on rating rules. */
  maximum_premium: number | null;
  maximum_premium_applied: boolean;
  loading_rate: number | null;
  loading_amount: number;
  loading_approval_required: boolean;
  discount_type: PricingAdjustmentType;
  discount_rate: number | null;
  discount_amount: number;
  discount_approval_required: boolean;
  premium_before_discount: number;
  premium_after_discount: number;
  premium_excluding_tax: number;
  premium_excluding_tax_equivalent: number;
  tax_rate: number | null;
  tax_amount: number;
  total_tax_amount: number;
  premium_including_tax: number;
  premium_including_tax_equivalent: number;
  final_payable_premium: number;
}

export interface MultiRiskPremiumFailure {
  client_reference: string | null;
  risk_id: string | null;
  status: 'FAILED' | 'INCOMPLETE';
  message: string;
  validation_errors: string[];
  validation_warnings: string[];
  details: Record<string, unknown> | null;
}

export interface MultiRiskPremiumResult {
  risks: RiskPremiumResult[];
  failed_risks: MultiRiskPremiumFailure[];
  grand_total: number;
  successful_risk_count: number;
  failed_risk_count: number;
  premium_breakdown?: PricingPremiumBreakdown;
}

export type PersistedRiskPremiumResult = RiskPremiumResult &
  PricingQuoteMetadata;

export type PersistedMultiRiskPremiumResult = MultiRiskPremiumResult &
  PricingQuoteMetadata;

export interface RiskRuleConditionSummary {
  factor_code: string;
  operator: ConditionOperator;
  value_from: string | null;
  value_to: string | null;
  logical_operator: LogicalOperator;
}

export interface RiskRuleExplanation {
  risk_id: string;
  risk_code: string;
  risk_name: string;
  rate_book_id: string | null;
  rate_book_code: string | null;
  rate_book_version: string | null;
  rule_id: string;
  rule_name: string;
  rule_version: number | null;
  priority: number;
  rate_type: RateType;
  percentage_rate: number;
  fixed_amount: number;
  per_unit_amount: number;
  per_unit_factor_code: string | null;
  minimum_amount: number;
  formula: string | null;
  conditions: RiskRuleConditionSummary[];
  other_active_rule_count: number;
}

export interface RuleCalculationBreakdown {
  percentage_rate: number;
  percentage_amount: number;
  raw_premium: number;
  base_premium: number;
  per_unit_factor_code: string | null;
  per_unit_value: number;
  per_unit_amount: number;
  per_unit_premium: number;
  fixed_amount: number;
  minimum_amount: number;
  gross_premium: number;
  final_premium: number;
  minimum_applied: boolean;
}

export interface PricingFactorValidationResult {
  normalized_factor_values: PricingFactorValues;
  errors: PricingValidationIssue[];
  warnings: PricingValidationIssue[];
  calculation_allowed: boolean;
}

export interface PricingValidationIssue {
  field: string;
  code: string;
  message: string;
}

export interface PricingValidationFailurePayload {
  status: 'INCOMPLETE';
  calculation_allowed: false;
  message: string;
  errors: PricingValidationIssue[];
  warnings: PricingValidationIssue[];
  validation_errors: string[];
  validation_warnings: string[];
}

export interface PricingQuoteSnapshot<T> {
  pricing_quote_id: string;
  pricing_status: 'CALCULATED';
  calculated_at: string;
  expires_at: string;
  input_signature: string;
  quotation_type: string | null;
  currency_code: string | null;
  result: T;
}

export interface StoredPricingQuote {
  pricing_quote_id: string;
  pricing_status: 'CALCULATED';
  quote_scope: 'SINGLE_RISK' | 'MULTI_RISK';
  calculated_at: string;
  expires_at: string;
  input_signature: string;
  quotation_type: string | null;
  currency_code: string | null;
  product_id: string | null;
  risk_id: string | null;
  rate_book_id: string | null;
  rate_book_version: string | null;
  matched_rule_id: string | null;
  matched_rule_version: number | null;
  base_premium: number;
  minimum_premium_adjustment: number;
  gross_premium: number;
  final_premium: number;
  input_payload: Record<string, unknown>;
  factor_payload: Record<string, unknown> | null;
  result_payload: Record<string, unknown>;
  warning_messages: string[];
  context_payload: Record<string, unknown> | null;
}
