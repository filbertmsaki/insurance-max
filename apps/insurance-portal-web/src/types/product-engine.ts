import type { MotorCoverClass } from '@insurance-max/contracts';

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
  | 'DECIMAL'
  | 'INTEGER'
  | 'TEXT'
  | 'DATE'
  | 'BOOLEAN'
  | 'SELECT'
  | 'MULTI_SELECT';

export type FactorUnit = 'CURRENCY' | 'SEAT' | 'TONNE' | 'YEAR';

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

export type ProductLifecycleStatus = 'DRAFT' | 'ACTIVE' | 'RETIRED';
export type ProductVersionStatus = 'DRAFT' | 'PUBLISHED' | 'RETIRED';
export type ProductReviewStatus =
  | 'DRAFT'
  | 'IN_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'REQUIRES_REVIEW';
export type ProductDefinitionItemType =
  | 'COVERAGE'
  | 'BENEFIT'
  | 'CONDITION'
  | 'WARRANTY'
  | 'EXCLUSION';
export type ProductDocumentRequirementType =
  | 'IDENTITY'
  | 'OWNERSHIP'
  | 'FINANCIAL'
  | 'RISK_INFORMATION'
  | 'REGULATORY'
  | 'OTHER';
export type ProductRequirementAppliesTo =
  | 'QUOTATION'
  | 'APPROVAL'
  | 'PAYMENT'
  | 'POLICY_ISSUANCE'
  | 'CLAIM';

// ─── Pagination ───────────────────────────────────────────────────────────────

export type {
  Pagination as PEMeta,
  PaginatedResponse as PEPage,
} from '@/modules/shared/api/pagination';

// ─── Insurance Categories ─────────────────────────────────────────────────────

export interface InsuranceCategory {
  policy_numbering_code?: string;
  id: string;
  code: string;
  name: string;
  description: string | null;
  business_line: InsuranceBusinessLine;
  is_active: boolean;
  tiramis_category_code: string | null;
  sort_order: number;
  created_at: string;
  updated_at?: string;
}

export interface CreateCategoryDto {
  code: string;
  name: string;
  description?: string;
  business_line: InsuranceBusinessLine;
  is_active?: boolean;
  tiramis_category_code?: string | null;
  sort_order?: number;
}

export interface UpdateCategoryDto {
  code?: string;
  name?: string;
  description?: string;
  business_line?: InsuranceBusinessLine;
  is_active?: boolean;
  tiramis_category_code?: string | null;
  sort_order?: number;
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
  policy_numbering_code?: string;
  id: string;
  category_id: string;
  product_code: string;
  product_name: string;
  description: string | null;
  business_line: InsuranceBusinessLine;
  supports_fleet?: boolean;
  tiramis_product_code?: string | null;
  is_active: boolean;

  lifecycle_status: ProductLifecycleStatus;
  latest_version_number: number;
  current_version_id: string | null;
  code_locked_at: string | null;

  created_at: string;
  category?: InsuranceCategory;
  current_version?: InsuranceProductVersion | null;
}

/** Creates the product identity and its version-1 draft in one call. */
export interface CreateProductDto {
  category_id: string;
  product_code: string;
  product_name: string;
  description?: string;
  supports_fleet?: boolean;
  tiramis_product_code?: string;
  cover_note_type?: number;
  default_cover_duration_days?: number;
  currency_code?: string;
}

/** Identity-only update — product terms are edited through versions. */
export interface UpdateProductDto {
  category_id?: string;
  product_code?: string;
}

export interface ProductDefinitionItem {
  id: string;
  code: string;
  item_type: ProductDefinitionItemType;
  title: string;
  description: string;
  is_mandatory: boolean;
  sort_order: number;
}

export interface ProductAddonDefinition {
  id: string;
  code: string;
  tiramis_addon_code: string | null;
  name: string;
  description: string | null;
  is_optional: boolean;
  is_default_selected: boolean;
  allows_separate_sum_insured: boolean;
  maximum_quantity: number | null;
  sort_order: number;
}

export interface ProductDocumentRequirement {
  id: string;
  code: string;
  requirement_type: ProductDocumentRequirementType;
  applies_to: ProductRequirementAppliesTo;
  name: string;
  description: string | null;
  is_mandatory: boolean;
  accepted_mime_types: string[];
  maximum_file_size_mb: number | null;
  sort_order: number;
}

export interface ProductVersionSubClass {
  id: string;
  sub_class_id: string;
  code_snapshot: string;
  name_snapshot: string;
  description_snapshot: string | null;
  tiramis_sub_class_code_snapshot: string | null;
  cover_type_code_snapshot: string | null;
  is_default: boolean;
  sort_order: number;
}

export interface InsuranceProductVersion {
  id: string;
  product_id: string;
  version_number: number;
  status: ProductVersionStatus;
  review_status: ProductReviewStatus;

  product_name: string;
  description: string | null;
  business_line: InsuranceBusinessLine;
  supports_fleet: boolean;
  tiramis_product_code: string | null;

  cover_note_type: number;
  default_cover_duration_days: number;
  currency_code: string;

  cover_note_description: string | null;
  operative_clause: string | null;
  policy_operative_clause: string | null;
  special_conditions: string | null;
  exclusions: string | null;
  allows_cover_text_override: boolean;

  effective_from: string | null;
  effective_to: string | null;

  is_submission_ready: boolean;
  definition_hash: string | null;
  review_comments: string | null;
  published_at: string | null;

  definition_items: ProductDefinitionItem[];
  addons: ProductAddonDefinition[];
  document_requirements: ProductDocumentRequirement[];
  sub_classes: ProductVersionSubClass[];
}

export interface UpsertProductVersionDto {
  product_name: string;
  description?: string | null;
  supports_fleet?: boolean;
  tiramis_product_code: string;
  cover_note_type: number;
  default_cover_duration_days: number;
  currency_code: string;
  cover_note_description: string;
  operative_clause: string;
  policy_operative_clause: string;
  special_conditions: string;
  exclusions: string;
  allows_cover_text_override?: boolean;
  effective_from: string;
  effective_to?: string | null;
  sub_class_ids?: string[];
  default_sub_class_id?: string | null;
  definition_items: Array<{
    code: string;
    item_type: ProductDefinitionItemType;
    title: string;
    description: string;
    is_mandatory?: boolean;
    sort_order?: number;
  }>;
  addons: Array<{
    code: string;
    tiramis_addon_code?: string | null;
    name: string;
    description?: string | null;
    is_optional?: boolean;
    is_default_selected?: boolean;
    allows_separate_sum_insured?: boolean;
    maximum_quantity?: number | null;
    sort_order?: number;
  }>;
  document_requirements: Array<{
    code: string;
    requirement_type: ProductDocumentRequirementType;
    applies_to: ProductRequirementAppliesTo;
    name: string;
    description?: string | null;
    is_mandatory?: boolean;
    accepted_mime_types?: string[];
    maximum_file_size_mb?: number | null;
    sort_order?: number;
  }>;
}

export interface ProductDefinitionSnapshot {
  productId: string;
  productVersionId: string;
  versionNumber: number;
  categoryId: string;
  categoryCode: string;
  categoryName: string;
  productCode: string;
  productName: string;
  description: string | null;
  businessLine: InsuranceBusinessLine;
  lifecycleStatus: ProductLifecycleStatus;
  versionStatus: ProductVersionStatus;
  reviewStatus: ProductReviewStatus;
  tiramisProductCode: string;
  supportsFleet: boolean;
  coverNoteType: number;
  defaultCoverDurationDays: number;
  currencyCode: string;
  coverNoteDescription: string;
  operativeClause: string;
  policyOperativeClause: string;
  specialConditions: string;
  exclusions: string;
  allowsCoverTextOverride: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  definitionItems: Array<{
    id: string;
    code: string;
    itemType: ProductDefinitionItemType;
    title: string;
    description: string;
    isMandatory: boolean;
    sortOrder: number;
  }>;
  addons: Array<{
    id: string;
    code: string;
    tiraAddonCode: string | null;
    name: string;
    description: string | null;
    isOptional: boolean;
    isDefaultSelected: boolean;
    allowsSeparateSumInsured: boolean;
    maximumQuantity: number | null;
    sortOrder: number;
  }>;
  documentRequirements: Array<{
    id: string;
    code: string;
    requirementType: ProductDocumentRequirementType;
    appliesTo: ProductRequirementAppliesTo;
    name: string;
    description: string | null;
    isMandatory: boolean;
    acceptedMimeTypes: string[];
    maximumFileSizeMb: number | null;
    sortOrder: number;
  }>;
  subClasses: Array<{
    id: string;
    code: string;
    name: string;
    description: string | null;
    tiramisSubClassCode: string | null;
    coverTypeCode: string | null;
    isDefault: boolean;
    sortOrder: number;
  }>;
  definitionHash: string;
  publishedAt: string | null;
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
  tiramis_sub_class_code: string | null;
  cover_type_code: string | null;
  sort_order: number;
  created_at: string;
  product?: InsuranceProduct;
}

export interface CreateSubClassDto {
  product_id: string;
  code: string;
  name: string;
  description?: string;
  is_active?: boolean;
  tiramis_sub_class_code?: string | null;
  cover_type_code?: string | null;
  sort_order?: number;
}

export interface UpdateSubClassDto {
  product_id?: string;
  code?: string;
  name?: string;
  description?: string;
  is_active?: boolean;
  tiramis_sub_class_code?: string | null;
  cover_type_code?: string | null;
  sort_order?: number;
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
  /** Motor cover class (see `MotorCoverClass`); null when not configured. */
  cover_class?: MotorCoverClass | null;
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
  cover_class?: MotorCoverClass | null;
  is_active?: boolean;
}

export interface UpdateRiskDto {
  product_id?: string;
  sub_class_id?: string | null;
  risk_code?: string;
  risk_name?: string;
  description?: string;
  cover_class?: MotorCoverClass | null;
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
  unit: FactorUnit | null;
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
  unit?: FactorUnit | null;
  options?: string[];
  default_value?: string;
  is_required?: boolean;
  is_active?: boolean;
}

export interface UpdateFactorDto {
  code?: string;
  name?: string;
  data_type?: FactorDataType;
  unit?: FactorUnit | null;
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
  rate_book_id?: string | null;
}

export interface RiskRatingRequirements {
  risk_id: string;
  risk_code: string;
  risk_name: string;
  product_id: string;
  product_code: string | null;
  product_name: string | null;
  pricing_available: boolean;
  required_factors: RiskRequiredFactor[];
}

export interface CreateRequiredFactorDto {
  rate_book_id: string;
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
  rate_book_id?: string | null;
  rule_name: string;
  rate_type: RateType;
  percentage_rate: number | null;
  fixed_amount: number | null;
  per_unit_amount: number | null;
  per_unit_factor_code: string | null;
  minimum_amount: number | null;
  maximum_amount?: number | null;
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
  risk?: InsuranceRisk;
}

export interface CreateRuleDto {
  risk_id: string;
  rate_book_id?: string;
  rule_name: string;
  rate_type: RateType;
  percentage_rate?: number | null;
  fixed_amount?: number | null;
  per_unit_amount?: number | null;
  per_unit_factor_code?: string | null;
  minimum_amount?: number | null;
  maximum_amount?: number | null;
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
  maximum_amount?: number | null;
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
  rate_book_id?: string;
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

// ─── Pricing Rate Books ───────────────────────────────────────────────────────

export type PricingRateBookStatus =
  | 'DRAFT'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'PUBLISHED'
  | 'RETIRED'
  | 'REJECTED';

export type PricingRoundingMode = 'HALF_UP' | 'UP' | 'DOWN';

export type PricingProrationMethod =
  | 'NONE'
  | 'DAILY_365'
  | 'DAILY_366'
  | 'MONTHLY_12';

export interface PricingRateBook {
  id: string;
  company_id: string;
  product_id: string;
  code: string;
  version: string;
  name: string | null;
  currency_code: string | null;
  status: PricingRateBookStatus;
  effective_from: string;
  effective_to: string | null;
  product_version_id: string | null;
  product_definition_hash: string | null;
  definition_hash: string | null;
  calculation_version: string;
  rounding_mode: PricingRoundingMode;
  rounding_increment: string | number;
  proration_method: PricingProrationMethod;
  metadata: Record<string, unknown> | null;
  created_by?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  published_by?: string | null;
  published_at?: string | null;
  created_at: string;
  updated_at: string;
  product?: InsuranceProduct;
  product_version?: InsuranceProductVersion;
  rules?: RiskRatingRule[];
}

export interface CreatePricingRateBookDto {
  product_version_id: string;
  code: string;
  version: string;
  name?: string;
  currency_code?: string;
  effective_from: string;
  effective_to?: string | null;
  rounding_mode?: PricingRoundingMode;
  rounding_increment?: number;
  proration_method?: PricingProrationMethod;
}

export type UpdatePricingRateBookDto = Partial<CreatePricingRateBookDto>;

export interface ClonePricingRateBookDto {
  source_rate_book_id: string;
  version: string;
  code?: string;
  name?: string;
  effective_from?: string;
  effective_to?: string | null;
}

export interface RateBookQueryParams {
  product_id?: string;
  status?: PricingRateBookStatus;
}

// ─── Product Add-on Rate Rules ────────────────────────────────────────────────

export type AddonPricingType = 'PERCENTAGE' | 'FIXED' | 'PER_UNIT' | 'INCLUDED';

export interface ProductAddonRateRule {
  id: string;
  company_id: string;
  rate_book_id: string;
  product_version_id: string;
  addon_definition_id: string;
  rule_code: string;
  pricing_type: AddonPricingType;
  percentage_rate: number | null;
  fixed_amount: number | null;
  per_unit_amount: number | null;
  per_unit_factor_code: string | null;
  minimum_amount: number | null;
  maximum_amount: number | null;
  effective_from: string | null;
  effective_to: string | null;
  priority: number;
  is_active: boolean;
  created_at: string;
  addon_definition?: ProductAddonDefinition;
}

export interface CreateAddonRateRuleDto {
  addon_definition_id: string;
  rule_code: string;
  pricing_type: AddonPricingType;
  percentage_rate?: number | null;
  fixed_amount?: number | null;
  per_unit_amount?: number | null;
  per_unit_factor_code?: string | null;
  minimum_amount?: number | null;
  maximum_amount?: number | null;
  effective_from?: string | null;
  effective_to?: string | null;
  priority?: number;
  is_active?: boolean;
}

export type UpdateAddonRateRuleDto = Partial<
  Omit<CreateAddonRateRuleDto, 'addon_definition_id'>
>;

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

  // --- Documented calculation-response contract (additive) ---
  premium_rate: number;
  premium_rate_percent: number;
  raw_premium: number;
  sum_insured_equivalent: number;
  minimum_premium: number;
  minimum_premium_applied: boolean;
  maximum_premium: number | null;
  maximum_premium_applied: boolean;
  loading_rate: number | null;
  loading_amount: number;
  loading_approval_required: boolean;
  discount_type: 'PERCENTAGE' | 'FIXED' | 'NONE';
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

  // --- Add-on pricing & proration (additive) ---
  base_addon_premium?: number | null;
  proration_factor?: number | null;
  addon_results?: RiskPremiumAddonResult[];
}

export interface RiskPremiumAddonResult {
  rule_id: string;
  addon_definition_id: string;
  addon_code: string;
  addon_name: string;
  pricing_type: string;
  percentage_rate: string | null;
  fixed_amount: string | null;
  per_unit_amount: string | null;
  per_unit_factor_code: string | null;
  minimum_amount: string | null;
  maximum_amount: string | null;
  quantity: number;
  sum_insured: number | null;
  calculated_premium: number;
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

export interface PricingAdjustmentRequest {
  rate?: number | null;
  fixed_amount?: number | null;
}

export interface SingleCalcRequestAddon {
  addon_definition_id: string;
  quantity?: number;
  sum_insured?: number;
}

export interface SingleCalcRequest {
  client_reference?: string;
  risk_id: string;
  sum_insured?: number;
  factors: Record<string, string | number | boolean>;
  effective_date?: string;
  cover_start_date?: string;
  cover_end_date?: string;
  currency_code?: string;
  exchange_rate?: number;
  discount?: PricingAdjustmentRequest | null;
  loading?: PricingAdjustmentRequest | null;
  tax_rule_ids?: string[] | null;
  /** Tax codes explicitly selected on the risk (e.g. VAT-MAINLAND). When
   * provided — including an empty array — charges are restricted to these
   * codes instead of every active company tax rule. */
  tax_codes?: string[] | null;
  addons?: SingleCalcRequestAddon[];
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

// ─── Product Tax Rules ────────────────────────────────────────────────────────

export type ProductChargeCategory =
  | 'TAX'
  | 'LEVY'
  | 'FEE'
  | 'POLICY_FEE'
  | 'STAMP_DUTY'
  | 'ADMINISTRATION_FEE'
  | 'PRODUCT_CHARGE'
  | 'RISK_CHARGE';

export type ProductTaxType = 'PERCENTAGE' | 'FIXED';

export type ProductCalculationBase =
  | 'GROSS_PREMIUM'
  | 'NET_PREMIUM'
  | 'BASIC_PREMIUM';

export type ProductRuleStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'EXPIRED';

export interface ProductTaxRule {
  id: string;
  company_id: string;
  category_id: string | null;
  product_id: string | null;
  risk_id: string | null;
  tax_name: string;
  tax_code: string;
  charge_category: ProductChargeCategory;
  tax_type: ProductTaxType;
  tax_rate: string | null;
  tax_amount: string | null;
  is_taxable: boolean;
  minimum_charge_amount: string | null;
  maximum_charge_amount: string | null;
  calculation_base: ProductCalculationBase;
  effective_from: string;
  effective_to: string;
  status: ProductRuleStatus;
  created_at: string;
  category?: InsuranceCategory | null;
  product?: InsuranceProduct | null;
  risk?: InsuranceRisk | null;
}

export interface CreateTaxRuleDto {
  company_id: string;
  category_id?: string | null;
  product_id?: string | null;
  risk_id?: string | null;
  tax_name: string;
  tax_code: string;
  charge_category?: ProductChargeCategory;
  tax_type: ProductTaxType;
  tax_rate?: number | null;
  tax_amount?: number | null;
  is_taxable?: boolean;
  minimum_charge_amount?: number | null;
  maximum_charge_amount?: number | null;
  calculation_base?: ProductCalculationBase;
  effective_from: string;
  effective_to: string;
  status?: ProductRuleStatus;
}
