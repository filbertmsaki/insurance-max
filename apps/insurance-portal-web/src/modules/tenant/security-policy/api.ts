import { apiClient } from '@/modules/shared/api/client';

export interface EffectiveSecurityPolicy {
  requireTwoFactorForAllUsers: boolean;
  requireTwoFactorForRoles: string[];
  requireTwoFactorForPermissions: string[];
  requireTwoFactorForUserTypes: string[];
  allowTrustedDeviceBypass: boolean;
}

export type SecurityPolicyStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'SUPERSEDED'
  | 'RETIRED';

export interface SecurityPolicyVersion {
  id: string;
  profile_name: string;
  version_number: number;
  status: SecurityPolicyStatus;
  description: string | null;
  policy: { twoFactor?: Record<string, unknown> };
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  effective_from: string | null;
  effective_to: string | null;
  created_at: string;
}

export interface SecurityPolicyOverview {
  effective: EffectiveSecurityPolicy;
  baseline: EffectiveSecurityPolicy;
  baseline_source: 'GLOBAL_POLICY' | 'DEFAULTS';
  active_version_id: string | null;
  versions: SecurityPolicyVersion[];
}

export interface SecurityPolicyDraftPayload {
  profile_name?: string;
  description?: string;
  two_factor: {
    require_for_all_users?: boolean;
    require_for_roles?: string[];
    require_for_permissions?: string[];
    require_for_user_types?: string[];
    allow_trusted_device_bypass?: boolean;
  };
}

const BASE = '/tenant/security-policy';

export const securityPolicyApi = {
  overview: () =>
    apiClient.get<SecurityPolicyOverview>(BASE).then((response) => response.data),

  createDraft: (payload: SecurityPolicyDraftPayload) =>
    apiClient
      .post<SecurityPolicyVersion>(`${BASE}/drafts`, payload)
      .then((response) => response.data),

  activate: (id: string) =>
    apiClient
      .post<SecurityPolicyVersion>(`${BASE}/${id}/activate`)
      .then((response) => response.data),

  retire: (id: string) =>
    apiClient
      .post<SecurityPolicyVersion>(`${BASE}/${id}/retire`)
      .then((response) => response.data),
};
