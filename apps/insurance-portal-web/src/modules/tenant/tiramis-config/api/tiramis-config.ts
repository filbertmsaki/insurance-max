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
  clientCode: string | null;
  systemCode: string | null;
  systemName: string | null;
  baseUrl: string | null;
  sourceService: string | null;
  callbackUrl: string | null;
  effectiveCallbackUrl?: string | null;
  effectiveBaseUrl?: string | null;
  effectiveSourceService?: string | null;
  effectiveTargetEnvironment?: 'test' | 'live';
  serviceCallbackUrl?: string | null;
  tiramisCallbackUrl?: string | null;
  tiramisCallbackPath?: string | null;
  isActiveCallback?: boolean;
  isTargetEnvironment?: boolean;
  serviceApiKeyMasked?: string | null;
  serviceApiKeyConfigured?: boolean;
  apiKeyStatus?: 'ACTIVE' | 'NOT_CONFIGURED';
  isActive: boolean;
  validationStatus: 'NOT_VALIDATED' | 'VALID' | 'INVALID';
  validatedAt: string | null;
  validationMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GeneratedCompanyTiramisApiKeyResponse extends CompanyTiramisConfiguration {
  generatedApiKey?: string;
}

export interface UpsertCompanyTiramisConfigurationDto {
  company_code: string;
  insurer_company_code?: string;
  client_code?: string;
  system_code: string;
  system_name?: string;
  base_url?: string;
  source_service?: string;
  callback_url?: string;
  tiramis_service_api_key?: string;
  is_active?: boolean;
  use_as_target_environment?: boolean;
  confirm_live_activation?: boolean;
  force_activation?: boolean;
}

export const tiramisConfigApi = {
  getMyConfigurations: () =>
    apiClient
      .get<
        CompanyTiramisConfiguration[]
      >('/companies/my/tiramis-configurations')
      .then((r) => r.data),

  upsertMyConfiguration: (
    environment: 'test' | 'live',
    data: UpsertCompanyTiramisConfigurationDto,
  ) =>
    apiClient
      .put<CompanyTiramisConfiguration>(
        `/companies/my/tiramis-configurations/${environment}`,
        data,
      )
      .then((r) => r.data),

  validateMyConfiguration: (environment: 'test' | 'live') =>
    apiClient
      .post<{
        valid: boolean;
        message?: string;
      }>(`/companies/my/tiramis-configurations/${environment}/validate`)
      .then((r) => r.data),

  activateMyConfiguration: (
    environment: 'test' | 'live',
    data: {
      confirm_live_activation?: boolean;
      force_activation?: boolean;
    } = {},
  ) =>
    apiClient
      .post<CompanyTiramisConfiguration>(
        `/companies/my/tiramis-configurations/${environment}/activate`,
        data,
      )
      .then((r) => r.data),

  generateMyApiKey: (environment: 'test' | 'live') =>
    apiClient
      .post<GeneratedCompanyTiramisApiKeyResponse>(
        `/companies/my/tiramis-configurations/${environment}/api-key/generate`,
      )
      .then((r) => r.data),
};
