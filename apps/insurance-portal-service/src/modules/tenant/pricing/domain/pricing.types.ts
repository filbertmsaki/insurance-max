import { ConditionOperator } from '@insurance-max/portal-shared/enums/condition-operator.enum';
import { LogicalOperator } from '@insurance-max/portal-shared/enums/logical-operator.enum';
import { RateType } from '@insurance-max/portal-shared/enums/rate-type.enum';

export type PricingFactorValues = Record<string, string | number | boolean>;

export interface PricingSingleRiskInput {
  client_reference?: string;
  risk_id: string;
  sum_insured: number;
  factors: PricingFactorValues;
  factor_values?: PricingFactorValues;
  effective_date?: string;
  quotation_type?: string;
  currency_code?: string;
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
  factors: PricingFactorValues;
  validation_errors: string[];
  validation_warnings: string[];
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
