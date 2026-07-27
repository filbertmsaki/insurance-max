// ─── Enums ────────────────────────────────────────────────────────────────────

export type RateType =
  | 'PERCENTAGE'
  | 'FIXED'
  | 'PERCENTAGE_PLUS_FIXED'
  | 'PERCENTAGE_PLUS_PER_UNIT'
  | 'PER_UNIT'
  | 'FORMULA';

export type FactorDataType =
  | 'NUMBER'
  | 'TEXT'
  | 'DATE'
  | 'BOOLEAN'
  | 'SELECT'
  | 'MULTI_SELECT';

export type ConditionOperator =
  | 'EQUALS'
  | 'NOT_EQUALS'
  | 'GREATER_THAN'
  | 'GREATER_THAN_OR_EQUAL'
  | 'LESS_THAN'
  | 'LESS_THAN_OR_EQUAL'
  | 'BETWEEN'
  | 'IN'
  | 'NOT_IN';

export type AccessStatus = 'ALLOW' | 'DENY';
export type LogicalOperator = 'AND' | 'OR';
export type InsuranceBusinessLine = 'MOTOR' | 'NON_MOTOR';

// ─── Pagination ───────────────────────────────────────────────────────────────

export type {
  Pagination as PEMeta,
  PaginatedResponse as PEPage,
} from '@/modules/shared/api/pagination';

// ─── Insurance Categories ─────────────────────────────────────────────────────

export interface InsuranceCategory {
  id: string;
  code: string;
  name: string;
  description: string | null;
  business_line: InsuranceBusinessLine;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface CreateCategoryDto {
  code: string;
  name: string;
  description?: string;
  business_line: InsuranceBusinessLine;
  is_active?: boolean;
}

export interface UpdateCategoryDto {
  code?: string;
  name?: string;
  description?: string;
  business_line?: InsuranceBusinessLine;
  is_active?: boolean;
}

export interface CategoryQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  business_line?: InsuranceBusinessLine;
  is_active?: boolean;
}

// ─── Insurance Products ───────────────────────────────────────────────────────

export interface InsuranceProduct {
  id: string;
  category_id: string;
  product_code: string;
  product_name: string;
  description: string | null;
  business_line: InsuranceBusinessLine;
  supports_fleet?: boolean;
  tiramis_product_code?: string | null;
  is_active: boolean;
  created_at: string;
  category?: InsuranceCategory;
}

export interface CreateProductDto {
  category_id: string;
  product_code: string;
  product_name: string;
  description?: string;
  business_line: InsuranceBusinessLine;
  supports_fleet?: boolean;
  tiramis_product_code?: string | null;
  is_active?: boolean;
}

export interface UpdateProductDto {
  category_id?: string;
  product_code?: string;
  product_name?: string;
  description?: string;
  business_line?: InsuranceBusinessLine;
  supports_fleet?: boolean;
  tiramis_product_code?: string | null;
  is_active?: boolean;
}

export interface ProductQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  category_id?: string;
  business_line?: InsuranceBusinessLine;
  supports_fleet?: boolean;
  is_active?: boolean;
}

// ─── Insurance Sub-Classes ────────────────────────────────────────────────────

export interface InsuranceSubClass {
  id: string;
  product_id: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  product?: InsuranceProduct;
}

export interface CreateSubClassDto {
  product_id: string;
  code: string;
  name: string;
  description?: string;
  is_active?: boolean;
}

export interface UpdateSubClassDto {
  product_id?: string;
  code?: string;
  name?: string;
  description?: string;
  is_active?: boolean;
}

export interface SubClassQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  product_id?: string;
  is_active?: boolean;
}

// ─── Insurance Risks ──────────────────────────────────────────────────────────

export interface InsuranceRisk {
  id: string;
  product_id: string;
  sub_class_id: string | null;
  risk_code: string;
  risk_name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  product?: InsuranceProduct;
  sub_class?: InsuranceSubClass;
}

export interface CreateRiskDto {
  product_id: string;
  sub_class_id?: string;
  risk_code: string;
  risk_name: string;
  description?: string;
  is_active?: boolean;
}

export interface UpdateRiskDto {
  product_id?: string;
  sub_class_id?: string | null;
  risk_code?: string;
  risk_name?: string;
  description?: string;
  is_active?: boolean;
}

export interface RiskQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  category_id?: string;
  product_id?: string;
  sub_class_id?: string;
  is_active?: boolean;
}

// ─── Rating Factors ───────────────────────────────────────────────────────────

export interface RatingFactor {
  id: string;
  code: string;
  name: string;
  data_type: FactorDataType;
  options: string[] | null;
  default_value: string | null;
  is_required: boolean;
  is_active: boolean;
  created_at: string;
}

export interface CreateFactorDto {
  code: string;
  name: string;
  data_type: FactorDataType;
  options?: string[];
  default_value?: string;
  is_required?: boolean;
  is_active?: boolean;
}

export interface UpdateFactorDto {
  code?: string;
  name?: string;
  data_type?: FactorDataType;
  options?: string[] | null;
  default_value?: string | null;
  is_required?: boolean;
  is_active?: boolean;
}

export interface FactorQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  data_type?: FactorDataType;
  is_active?: boolean;
}

// ─── Risk Required Factors ────────────────────────────────────────────────────

export interface RiskRequiredFactor {
  id: string;
  risk_id: string;
  factor_id: string;
  factor: RatingFactor;
  is_required: boolean;
  sort_order: number;
}

export interface CreateRequiredFactorDto {
  risk_id: string;
  factor_id: string;
  is_required?: boolean;
  sort_order?: number;
}

export interface UpdateRequiredFactorDto {
  is_required?: boolean;
  sort_order?: number;
}

// ─── Risk Rating Rules ────────────────────────────────────────────────────────

export interface RiskRatingRule {
  id: string;
  risk_id: string;
  rule_name: string;
  rate_type: RateType;
  percentage_rate: number | null;
  fixed_amount: number | null;
  per_unit_amount: number | null;
  per_unit_factor_code: string | null;
  minimum_amount: number | null;
  max_discount_rate: number | null;
  max_discount_amount: number | null;
  discount_approval_threshold_rate: number | null;
  discount_approval_threshold_amount: number | null;
  max_loading_rate: number | null;
  max_loading_amount: number | null;
  loading_approval_threshold_rate: number | null;
  loading_approval_threshold_amount: number | null;
  adjustment_effective_from: string | null;
  adjustment_effective_to: string | null;
  formula: string | null;
  priority: number;
  is_active: boolean;
  created_at: string;
  conditions?: RiskRuleCondition[];
}

export interface CreateRuleDto {
  risk_id: string;
  rule_name: string;
  rate_type: RateType;
  percentage_rate?: number | null;
  fixed_amount?: number | null;
  per_unit_amount?: number | null;
  per_unit_factor_code?: string | null;
  minimum_amount?: number | null;
  max_discount_rate?: number | null;
  max_discount_amount?: number | null;
  discount_approval_threshold_rate?: number | null;
  discount_approval_threshold_amount?: number | null;
  max_loading_rate?: number | null;
  max_loading_amount?: number | null;
  loading_approval_threshold_rate?: number | null;
  loading_approval_threshold_amount?: number | null;
  adjustment_effective_from?: string | null;
  adjustment_effective_to?: string | null;
  formula?: string | null;
  priority?: number;
  is_active?: boolean;
}

export interface UpdateRuleDto {
  rule_name?: string;
  rate_type?: RateType;
  percentage_rate?: number | null;
  fixed_amount?: number | null;
  per_unit_amount?: number | null;
  per_unit_factor_code?: string | null;
  minimum_amount?: number | null;
  max_discount_rate?: number | null;
  max_discount_amount?: number | null;
  discount_approval_threshold_rate?: number | null;
  discount_approval_threshold_amount?: number | null;
  max_loading_rate?: number | null;
  max_loading_amount?: number | null;
  loading_approval_threshold_rate?: number | null;
  loading_approval_threshold_amount?: number | null;
  adjustment_effective_from?: string | null;
  adjustment_effective_to?: string | null;
  formula?: string | null;
  priority?: number;
  is_active?: boolean;
}

export interface RuleQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  risk_id?: string;
  is_active?: boolean;
}

// ─── Risk Rule Conditions ─────────────────────────────────────────────────────

export interface RiskRuleCondition {
  id: string;
  rule_id: string;
  factor_code: string;
  operator: ConditionOperator;
  value_from: string | null;
  value_to: string | null;
  logical_operator: LogicalOperator;
}

export interface CreateConditionDto {
  rule_id: string;
  factor_code: string;
  operator: ConditionOperator;
  value_from?: string | null;
  value_to?: string | null;
  logical_operator?: LogicalOperator;
}

export interface UpdateConditionDto {
  factor_code?: string;
  operator?: ConditionOperator;
  value_from?: string | null;
  value_to?: string | null;
  logical_operator?: LogicalOperator;
}

// ─── Access Control ───────────────────────────────────────────────────────────

export interface AccessRecord {
  id: string;
  branch_id?: string;
  department_id?: string;
  company_user_id?: string;
  category_id?: string;
  product_id?: string;
  can_view: boolean;
  can_create_policy: boolean;
  access_status: AccessStatus;
  is_active: boolean;
  created_at?: string;
  category?: InsuranceCategory;
  product?: InsuranceProduct;
}

export interface GrantCategoryAccessDto {
  branch_id?: string;
  department_id?: string;
  company_user_id?: string;
  category_id: string;
  can_view?: boolean;
  can_create_policy?: boolean;
  access_status?: AccessStatus;
}

export interface GrantProductAccessDto {
  branch_id?: string;
  department_id?: string;
  company_user_id?: string;
  product_id: string;
  can_view?: boolean;
  can_create_policy?: boolean;
  access_status?: AccessStatus;
}

export interface ResolveAccessDto {
  company_user_id: string;
  branch_id?: string;
  department_id?: string;
  category_id?: string;
  product_id?: string;
}

// ─── Premium Calculator ───────────────────────────────────────────────────────

export interface RiskPremiumResult {
  premium_breakdown?: {
    pricing_quote_id: string;
    status: 'CALCULATED' | 'PARTIAL' | 'INCOMPLETE';
    currency: string | null;
    rate_book: {
      code: string | null;
      version: string | null;
    };
    items: Array<{
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
      loadings: Array<{
        code: string;
        name: string;
        amount: number;
        rate: number | null;
      }>;
      discounts: Array<{
        code: string;
        name: string;
        amount: number;
        rate: number | null;
      }>;
      premium_after_discount: number;
      taxes: Array<{
        charge_code: string;
        charge_name: string;
        charge_category:
          | 'TAX'
          | 'LEVY'
          | 'FEE'
          | 'POLICY_FEE'
          | 'STAMP_DUTY'
          | 'ADMINISTRATION_FEE'
          | 'PRODUCT_CHARGE'
          | 'RISK_CHARGE';
        charge_scope: 'COMPANY' | 'CATEGORY' | 'PRODUCT' | 'RISK';
        charge_type: 'PERCENTAGE' | 'FIXED';
        calculation_base: 'BASIC_PREMIUM' | 'NET_PREMIUM' | 'GROSS_PREMIUM';
        base_amount: number;
        rate: number | null;
        amount: number;
        is_taxable: boolean;
      }>;
      other_charges: Array<{
        charge_code: string;
        charge_name: string;
        charge_category:
          | 'TAX'
          | 'LEVY'
          | 'FEE'
          | 'POLICY_FEE'
          | 'STAMP_DUTY'
          | 'ADMINISTRATION_FEE'
          | 'PRODUCT_CHARGE'
          | 'RISK_CHARGE';
        charge_scope: 'COMPANY' | 'CATEGORY' | 'PRODUCT' | 'RISK';
        charge_type: 'PERCENTAGE' | 'FIXED';
        calculation_base: 'BASIC_PREMIUM' | 'NET_PREMIUM' | 'GROSS_PREMIUM';
        base_amount: number;
        rate: number | null;
        amount: number;
        is_taxable: boolean;
      }>;
      final_premium: number;
      matched_rule: {
        rule_id: string;
        rule_name: string;
        rule_version: number | null;
      };
    }>;
    totals: {
      base_premium: number;
      raw_premium: number;
      loadings: number;
      discounts: number;
      premium_after_discount: number;
      taxes: number;
      other_charges: number;
      payable_premium: number;
    };
    errors: Array<{
      client_reference: string | null;
      risk_id: string | null;
      risk_code: string | null;
      message: string;
    }>;
    warnings: Array<{
      client_reference: string | null;
      risk_id: string | null;
      risk_code: string | null;
      message: string;
    }>;
    expires_at: string;
  };
  client_reference?: string | null;
  risk_id: string;
  risk_code: string;
  risk_name: string;
  rule_id: string;
  rule_name: string;
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
  charges: Array<{
    applied_rule_id: string;
    charge_code: string;
    charge_name: string;
    charge_category:
      | 'TAX'
      | 'LEVY'
      | 'FEE'
      | 'POLICY_FEE'
      | 'STAMP_DUTY'
      | 'ADMINISTRATION_FEE'
      | 'PRODUCT_CHARGE'
      | 'RISK_CHARGE';
    charge_scope: 'COMPANY' | 'CATEGORY' | 'PRODUCT' | 'RISK';
    charge_type: 'PERCENTAGE' | 'FIXED';
    calculation_base: 'BASIC_PREMIUM' | 'NET_PREMIUM' | 'GROSS_PREMIUM';
    base_amount: number;
    rate: number | null;
    fixed_amount: number | null;
    minimum_charge_amount: number | null;
    maximum_charge_amount: number | null;
    computed_amount: number;
    is_taxable: boolean;
    effective_from: string;
    effective_to: string;
  }>;
  total_charge_amount: number;
  taxable_charge_amount: number;
  non_taxable_charge_amount: number;
  premium_including_charges: number;
  exchange_rate_snapshot?: {
    quotation_currency_code: string;
    base_currency_code: string;
    exchange_rate: number;
    exchange_rate_source: 'PARITY' | 'MANUAL';
    exchange_rate_date: string;
    exchange_rate_precision: number;
    approval_required: boolean;
    approval_granted: boolean;
    approved_by_user_id: string | null;
    approved_at: string | null;
    conversion_direction: 'QUOTE_TO_BASE_MULTIPLY';
    rounding_method: 'ROUND_HALF_UP';
  } | null;
  discount_control: {
    max_rate: number | null;
    max_amount: number | null;
    approval_threshold_rate: number | null;
    approval_threshold_amount: number | null;
    effective_from: string | null;
    effective_to: string | null;
  };
  loading_control: {
    max_rate: number | null;
    max_amount: number | null;
    approval_threshold_rate: number | null;
    approval_threshold_amount: number | null;
    effective_from: string | null;
    effective_to: string | null;
  };
  factors: Record<string, string | number | boolean>;
  validation_errors: string[];
  validation_warnings: string[];
  pricing_quote_id?: string;
  pricing_status?: 'CALCULATED';
  calculated_at?: string;
  expires_at?: string;
  input_signature?: string;
  quotation_type?: string | null;
  currency_code?: string | null;
}

export interface MultiCalcFailure {
  client_reference: string | null;
  risk_id: string | null;
  status: 'FAILED' | 'INCOMPLETE';
  message: string;
  validation_errors: string[];
  validation_warnings: string[];
  details: Record<string, unknown> | null;
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

export interface SingleCalcRequest {
  client_reference?: string;
  risk_id: string;
  sum_insured: number;
  factors: Record<string, string | number | boolean>;
  effective_date?: string;
  currency_code?: string;
  exchange_rate?: number;
}

export interface MultiCalcRequest {
  product_code?: string;
  effective_date?: string;
  currency_code?: string;
  exchange_rate?: number;
  risks: SingleCalcRequest[];
}

export interface MultiCalcResponse {
  risks: RiskPremiumResult[];
  failed_risks: MultiCalcFailure[];
  grand_total: number;
  successful_risk_count: number;
  failed_risk_count: number;
  premium_breakdown?: RiskPremiumResult['premium_breakdown'];
}

export interface RiskRuleConditionSummary {
  factor_code: string;
  operator: ConditionOperator;
  value_from: string | null;
  value_to: string | null;
  logical_operator: LogicalOperator;
}

/** Response of GET /premium-calculation/explain/:risk_id — the resolved
 * highest-priority active rule for a risk, without running a calculation. */
export interface RiskRuleExplanation {
  risk_id: string;
  risk_code: string;
  risk_name: string;
  rule_id: string;
  rule_name: string;
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

// ─── Department (for access dropdowns) ───────────────────────────────────────

export interface Department {
  id: string;
  company_id: string;
  branch_id: string;
  name: string;
  code: string;
  description: string | null;
  status: string;
}
