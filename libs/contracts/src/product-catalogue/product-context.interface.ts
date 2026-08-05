export interface ServiceProductContext {
  productId: string;
  productVersionId: string;
  versionNumber: number;

  productCode: string;
  tiramisProductCode: string;

  definitionHash: string;

  coverNoteType: number;

  coverNoteDescriptionHash: string;
  operativeClauseHash: string;
  policyOperativeClauseHash: string;
  specialConditionsHash: string;
  exclusionsHash: string;

  allowsCoverTextOverride: boolean;
}
