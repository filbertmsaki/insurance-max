import type {
  MultiCalcFailure,
  MultiCalcRequest,
  MultiCalcResponse,
  RiskPremiumResult,
  RiskRatingRequirements,
  RiskRequiredFactor,
  RiskRuleExplanation,
  SingleCalcRequest,
} from '@/types/product-engine';

export type PricingFactorValue = string | number | boolean;
export type PricingFactorValues = Record<string, PricingFactorValue>;

export type PricingSingleRiskRequest = SingleCalcRequest;
export type PricingMultiRiskRequest = MultiCalcRequest;
export type PricingSingleRiskResult = RiskPremiumResult;
export type PricingMultiRiskResult = MultiCalcResponse;
export type PricingMultiRiskFailure = MultiCalcFailure;

export interface PricingFleetRequest {
  risk_id: string;
  vehicles: Array<{
    client_reference: string;
    sum_insured?: number;
    factors: Record<string, string | number | boolean>;
  }>;
  discount?: { rate?: number; fixed_amount?: number };
  tax_codes?: string[];
  product_code?: string;
  effective_date?: string;
  cover_start_date?: string;
  cover_end_date?: string;
  quotation_type?: string;
  currency_code?: string;
  exchange_rate?: number;
}

/** Fleet totals computed by the backend: per-vehicle amounts rounded, then summed. */
export interface PricingFleetTotals {
  vehicle_count: number;
  priced_vehicle_count: number;
  sum_insured: number;
  premium_before_discount: number;
  discount_amount: number;
  premium_excluding_tax: number;
  tax_amount: number;
  premium_including_tax: number;
}

export type PricingFleetResult = MultiCalcResponse & {
  risk_id: string;
  fleet_totals: PricingFleetTotals;
};
export type PricingRequiredFactor = RiskRequiredFactor;
export type PricingRatingRequirements = RiskRatingRequirements;
export type PricingRuleExplanation = RiskRuleExplanation;

export type PricingCalculationState =
  | 'IDLE'
  | 'LOADING'
  | 'CALCULATING'
  | 'CALCULATED'
  | 'INCOMPLETE'
  | 'WARNING'
  | 'REFERRAL_REQUIRED'
  | 'STALE'
  | 'ERROR'
  | 'EXPIRED';

export interface PricingQuoteMetadata {
  pricing_quote_id?: string | null;
  pricing_status?: 'CALCULATED' | 'STALE' | null;
  calculated_at?: string | null;
  expires_at?: string | null;
  input_signature?: string | null;
  pricing_input_signature?: string | null;
  pricing_is_stale?: boolean;
  stale_reason?: string | null;
  quotation_type?: string | null;
  currency_code?: string | null;
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
  minimum_applied?: boolean;
  minimum_amount?: number;
  discount_control?: {
    max_rate?: number | null;
    max_amount?: number | null;
    approval_threshold_rate?: number | null;
    approval_threshold_amount?: number | null;
    effective_from?: string | null;
    effective_to?: string | null;
  } | null;
  loading_control?: {
    max_rate?: number | null;
    max_amount?: number | null;
    approval_threshold_rate?: number | null;
    approval_threshold_amount?: number | null;
    effective_from?: string | null;
    effective_to?: string | null;
  } | null;
  discount_approval_required?: boolean;
  loading_approval_required?: boolean;
  validation_errors?: string[];
  validation_warnings?: string[];
}
