import { apiClient } from '@/modules/shared/api/client';

export interface CompanyTiramisConfiguration {
  id: string;
  companyId: string;
  environment: 'test' | 'live';
  environmentLabel?: string;
  companyCode: string;
  companyName: string | null;
  insurerCompanyCode: string | null;
  insurerCompanyName: string | null;
  effectiveBaseUrl?: string | null;
  effectiveSourceService?: string | null;
  effectiveTargetEnvironment?: 'test' | 'live';
  isTargetEnvironment?: boolean;
  serviceApiKeyMasked?: string | null;
  serviceApiKeyConfigured?: boolean;
  apiKeyStatus?: 'ACTIVE' | 'NOT_CONFIGURED' | 'RECOVERY_REQUIRED';
  isActive: boolean;
  validationStatus: 'NOT_VALIDATED' | 'VALID' | 'INVALID';
  validatedAt: string | null;
  validationMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Read-only: TIRAMIS connection setup (linking, API key generation,
 * validation, activation) is a platform-admin action performed on behalf
 * of the company — see modules/platform/tiramis-config. Company admins get
 * zero-configuration visibility into connection status only.
 */
export const tiramisConfigApi = {
  getMyConfigurations: () =>
    apiClient
      .get<
        CompanyTiramisConfiguration[]
      >('/companies/my/tiramis-configurations')
      .then((r) => r.data),
};
