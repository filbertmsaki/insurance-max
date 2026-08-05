import { apiClient } from '@/modules/shared/api/client';

export interface CompanyTiramisConfiguration {
  id: string;
  companyId: string;
  environment: 'test' | 'live';
  companyCode: string;
  companyName: string | null;
  insurerCompanyCode: string | null;
  insurerCompanyName: string | null;
  clientCode: string | null;
  systemCode: string | null;
  systemName: string | null;
  baseUrl: string | null;
  callbackUrl: string | null;
  isActive: boolean;
  validationStatus: 'NOT_VALIDATED' | 'VALID' | 'INVALID';
  validatedAt: string | null;
  validationMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertCompanyTiramisConfigurationDto {
  company_code: string;
  insurer_company_code?: string;
  client_code?: string;
  system_code: string;
  system_name?: string;
  callback_url?: string;
  is_active?: boolean;
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
};
