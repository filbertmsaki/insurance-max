export interface CreatePolicyDto {
  environment: string;
  clientConfigurationId: string;
  sourceModule?: string;
  sourceRecordId?: string;
  companyCode: string;
  systemCode: string;
  callbackUrl: string;
  insurerCompanyCode: string;
  policyNumber: string;
  policyOperativeClause: string;
  specialConditions: string;
  exclusions?: string | null;
  coverNoteReferenceNumbers: string[];
}
