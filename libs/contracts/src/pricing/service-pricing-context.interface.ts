export interface ServicePricingContext {
  pricingQuoteId: string;

  productVersionId: string;
  productDefinitionHash: string;

  rateBookId: string;
  rateBookCode: string;
  rateBookVersion: string;
  rateBookDefinitionHash: string;

  matchedRuleId: string;
  matchedRuleVersion: number;

  riskId: string;
  riskCode: string;

  currencyCode: string | null;

  basicPremium: string;
  addonPremium: string;
  loadingAmount: string;
  discountAmount: string;

  premiumExcludingTax: string;
  taxAmount: string;
  premiumIncludingTax: string;
  finalPayablePremium: string;

  calculationVersion: string;

  inputHash: string;
  resultHash: string;
}
