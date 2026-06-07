export interface CreateCoverNoteTaxDto {
  taxCode: string;
  isTaxExempted?: string;
  taxExemptionType?: string | null;
  taxExemptionReference?: string | null;
  taxRate: string;
  taxAmount: string;
}

export interface CreateCoverNoteDiscountDto {
  discountType?: number | null;
  discountRate?: string | null;
  discountAmount?: string | null;
}

export interface CreateCoverNoteRiskDto {
  riskCode: string;
  sumInsured: string;
  sumInsuredEquivalent: string;
  premiumRate: string;
  premiumBeforeDiscount: string;
  premiumAfterDiscount: string;
  premiumExcludingTaxEquivalent: string;
  premiumIncludingTax: string;
  discounts?: CreateCoverNoteDiscountDto[];
  taxes?: CreateCoverNoteTaxDto[];
}

export interface CreateSubjectMatterDto {
  subjectMatterReference: string;
  subjectMatterDesc: string;
}

export interface CreateCoverNoteAddonDto {
  addonReference: string;
  addonDesc: string;
  addonAmount: string;
  addonPremiumRate: string;
  premiumExcludingTax: string;
  premiumExcludingTaxEquivalent: string;
  premiumIncludingTax: string;
  taxes?: CreateCoverNoteTaxDto[];
}

export interface CreatePolicyHolderDto {
  policyHolderName: string;
  policyHolderBirthDate?: Date | string | null;
  policyHolderType: number;
  policyHolderIdNumber: string;
  policyHolderIdType: number;
  gender?: string | null;
  countryCode: string;
  region: string;
  district: string;
  street?: string | null;
  phoneNumber: string;
  fax?: string | null;
  postalAddress?: string | null;
  emailAddress?: string | null;
}

export interface CreateCoverNoteDto {
  coverNoteType: number;
  coverNoteNumber: string;
  prevCoverNoteReferenceNumber?: string | null;
  salePointCode: string;
  coverNoteStartDate: Date | string;
  coverNoteEndDate: Date | string;
  coverNoteDesc: string;
  operativeClause: string;
  paymentMode: number;
  currencyCode: string;
  exchangeRate: string;
  totalPremiumExcludingTax: string;
  totalPremiumIncludingTax: string;
  commissionPaid?: string | null;
  commissionRate?: string | null;
  officerName: string;
  officerTitle: string;
  productCode: string;
  endorsementType?: number | null;
  endorsementReason?: string | null;
  endorsementPremiumEarned?: string | null;
  risks: CreateCoverNoteRiskDto[];
  subjectMatters?: CreateSubjectMatterDto[];
  addons?: CreateCoverNoteAddonDto[];
  policyHolders: CreatePolicyHolderDto[];
}
