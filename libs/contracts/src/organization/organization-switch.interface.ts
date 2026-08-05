export interface SwitchOrganizationContextRequest {
  branch_id: string;
  department_id?: string | null;
  refresh_token: string;
}

export interface OrganizationReadinessResult {
  ready: boolean;
  missingRequirements: string[];
}
