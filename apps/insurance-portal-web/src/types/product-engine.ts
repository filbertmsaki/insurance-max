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

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PEMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PEPage<T> {
  data: T[];
  meta: PEMeta;
}

// ─── Insurance Categories ─────────────────────────────────────────────────────

export interface InsuranceCategory {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface CreateCategoryDto {
  code: string;
  name: string;
  description?: string;
  is_active?: boolean;
}

export interface UpdateCategoryDto {
  code?: string;
  name?: string;
  description?: string;
  is_active?: boolean;
}

export interface CategoryQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  is_active?: boolean;
}

// ─── Insurance Products ───────────────────────────────────────────────────────

export interface InsuranceProduct {
  id: string;
  category_id: string;
  product_code: string;
  product_name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  category?: InsuranceCategory;
}

export interface CreateProductDto {
  category_id: string;
  product_code: string;
  product_name: string;
  description?: string;
  is_active?: boolean;
}

export interface UpdateProductDto {
  category_id?: string;
  product_code?: string;
  product_name?: string;
  description?: string;
  is_active?: boolean;
}

export interface ProductQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  category_id?: string;
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
  factors: Record<string, string | number | boolean>;
  validation_errors: string[];
}

export interface SingleCalcRequest {
  risk_id: string;
  sum_insured: number;
  factors: Record<string, string | number | boolean>;
}

export interface MultiCalcRequest {
  risks: SingleCalcRequest[];
}

export interface MultiCalcResponse {
  risks: RiskPremiumResult[];
  grand_total: number;
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
