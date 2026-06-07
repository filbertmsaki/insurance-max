export interface CreatePolicyDto {
  policyNumber: string;
  policyOperativeClause: string;
  specialConditions: string;
  exclusions?: string | null;
  coverNoteReferenceNumbers: string[];
}
