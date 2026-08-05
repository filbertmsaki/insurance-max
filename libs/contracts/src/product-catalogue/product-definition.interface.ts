import type {
  ProductDefinitionItemType,
  ProductDocumentRequirementType,
  ProductLifecycleStatus,
  ProductRequirementAppliesTo,
  ProductReviewStatus,
  ProductVersionStatus,
} from './product-catalogue.enums';

export interface ProductDefinitionItemSnapshot {
  id: string;
  code: string;
  itemType: ProductDefinitionItemType;
  title: string;
  description: string;
  isMandatory: boolean;
  sortOrder: number;
}

export interface ProductAddonDefinitionSnapshot {
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
}

export interface ProductDocumentRequirementSnapshot {
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
}

export interface ProductSubClassSnapshot {
  id: string;
  code: string;
  name: string;
  description: string | null;
  tiramisSubClassCode: string | null;
  coverTypeCode: string | null;
  isDefault: boolean;
  sortOrder: number;
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

  businessLine: 'MOTOR' | 'NON_MOTOR';

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

  definitionItems: ProductDefinitionItemSnapshot[];

  addons: ProductAddonDefinitionSnapshot[];

  documentRequirements: ProductDocumentRequirementSnapshot[];

  subClasses: ProductSubClassSnapshot[];

  definitionHash: string;
  publishedAt: string | null;
}
