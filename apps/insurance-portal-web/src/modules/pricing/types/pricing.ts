import type {
  MultiCalcFailure,
  MultiCalcRequest,
  MultiCalcResponse,
  RiskPremiumResult,
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
export type PricingRequiredFactor = RiskRequiredFactor;
export type PricingRuleExplanation = RiskRuleExplanation;

export type PricingCalculationState =
  | 'IDLE'
  | 'LOADING'
  | 'CALCULATED'
  | 'INCOMPLETE'
  | 'ERROR'
  | 'EXPIRED';

export interface PricingQuoteMetadata {
  pricing_quote_id?: string | null;
  pricing_status?: 'CALCULATED' | null;
  calculated_at?: string | null;
  expires_at?: string | null;
  input_signature?: string | null;
  quotation_type?: string | null;
  currency_code?: string | null;
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
  validation_errors?: string[];
  validation_warnings?: string[];
}
