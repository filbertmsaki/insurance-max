import type {
  AddonPricingType,
  PricingProrationMethod,
  PricingRoundingMode,
} from './pricing.enums';

export interface PricingFactorSnapshot {
  factorId: string;
  code: string;
  name: string;
  dataType: string;
  unit: string | null;
  options: string[];
  defaultValue: string | null;
  required: boolean;
  sortOrder: number;
  validationRules: Record<string, unknown> | null;
}

export interface PricingRuleConditionSnapshot {
  id: string;
  factorCode: string;
  operator: string;
  valueFrom: string | number | boolean | null;
  valueTo: string | number | boolean | null;
  logicalOperator: string;
}

export interface PricingRuleSnapshot {
  ruleId: string;
  ruleName: string;
  ruleVersion: number;

  riskId: string;
  riskCode: string;
  riskName: string;

  priority: number;
  specificityScore: number;

  rateType: string;

  percentageRate: string | null;
  fixedAmount: string | null;
  perUnitAmount: string | null;
  perUnitFactorCode: string | null;

  minimumAmount: string | null;
  maximumAmount: string | null;

  maxDiscountRate: string | null;
  maxDiscountAmount: string | null;
  discountApprovalThresholdRate: string | null;
  discountApprovalThresholdAmount: string | null;

  maxLoadingRate: string | null;
  maxLoadingAmount: string | null;
  loadingApprovalThresholdRate: string | null;
  loadingApprovalThresholdAmount: string | null;

  conditions: PricingRuleConditionSnapshot[];
}

export interface AddonPricingRuleSnapshot {
  ruleId: string;
  addonDefinitionId: string;
  addonCode: string;
  addonName: string;

  pricingType: AddonPricingType;

  percentageRate: string | null;
  fixedAmount: string | null;
  perUnitAmount: string | null;
  perUnitFactorCode: string | null;

  minimumAmount: string | null;
  maximumAmount: string | null;

  quantity: number;
  sumInsured: string | null;
  calculatedPremium: string;
}

export interface PricingRateBookSnapshot {
  rateBookId: string;
  code: string;
  version: string;

  insurerCompanyId: string;

  productId: string;
  productVersionId: string;
  productDefinitionHash: string;

  currencyCode: string | null;

  effectiveFrom: string;
  effectiveTo: string | null;

  roundingMode: PricingRoundingMode;
  roundingIncrement: string;

  prorationMethod: PricingProrationMethod;

  calculationVersion: string;
  definitionHash: string | null;

  matchedRule: PricingRuleSnapshot;

  addons: AddonPricingRuleSnapshot[];
}

export interface PricingAdjustmentSnapshot {
  type: 'NONE' | 'PERCENTAGE' | 'FIXED';
  requestedRate: string | null;
  requestedAmount: string | null;
  appliedRate: string | null;
  appliedAmount: string;
  approvalRequired: boolean;
}

export interface PricingResultSnapshot {
  pricingQuoteId: string;
  calculationVersion: string;

  riskId: string;
  riskCode: string;
  riskName: string;

  currencyCode: string | null;

  sumInsured: string;

  rawPremium: string;
  premiumAfterMinimum: string;
  premiumAfterMaximum: string;

  baseAddonPremium: string;

  premiumBeforeLoading: string;
  loading: PricingAdjustmentSnapshot;

  premiumBeforeDiscount: string;
  discount: PricingAdjustmentSnapshot;

  premiumExcludingCharges: string;
  totalChargeAmount: string;
  finalPayablePremium: string;

  minimumPremiumApplied: boolean;
  maximumPremiumApplied: boolean;

  prorationFactor: string;

  rateBook: PricingRateBookSnapshot;

  inputHash: string;
  resultHash: string;

  calculatedAt: string;
  expiresAt: string;
}
