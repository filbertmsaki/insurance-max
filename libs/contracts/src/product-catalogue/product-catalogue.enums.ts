export const ProductLifecycleStatus = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  RETIRED: 'RETIRED',
} as const;

export type ProductLifecycleStatus =
  (typeof ProductLifecycleStatus)[keyof typeof ProductLifecycleStatus];

export const ProductVersionStatus = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  RETIRED: 'RETIRED',
} as const;

export type ProductVersionStatus =
  (typeof ProductVersionStatus)[keyof typeof ProductVersionStatus];

export const ProductReviewStatus = {
  DRAFT: 'DRAFT',
  IN_REVIEW: 'IN_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  REQUIRES_REVIEW: 'REQUIRES_REVIEW',
} as const;

export type ProductReviewStatus =
  (typeof ProductReviewStatus)[keyof typeof ProductReviewStatus];

export const ProductDefinitionItemType = {
  COVERAGE: 'COVERAGE',
  BENEFIT: 'BENEFIT',
  CONDITION: 'CONDITION',
  WARRANTY: 'WARRANTY',
  EXCLUSION: 'EXCLUSION',
} as const;

export type ProductDefinitionItemType =
  (typeof ProductDefinitionItemType)[keyof typeof ProductDefinitionItemType];

export const ProductDocumentRequirementType = {
  IDENTITY: 'IDENTITY',
  OWNERSHIP: 'OWNERSHIP',
  FINANCIAL: 'FINANCIAL',
  RISK_INFORMATION: 'RISK_INFORMATION',
  REGULATORY: 'REGULATORY',
  OTHER: 'OTHER',
} as const;

export type ProductDocumentRequirementType =
  (typeof ProductDocumentRequirementType)[keyof typeof ProductDocumentRequirementType];

export const ProductRequirementAppliesTo = {
  QUOTATION: 'QUOTATION',
  APPROVAL: 'APPROVAL',
  PAYMENT: 'PAYMENT',
  POLICY_ISSUANCE: 'POLICY_ISSUANCE',
  CLAIM: 'CLAIM',
} as const;

export type ProductRequirementAppliesTo =
  (typeof ProductRequirementAppliesTo)[keyof typeof ProductRequirementAppliesTo];
