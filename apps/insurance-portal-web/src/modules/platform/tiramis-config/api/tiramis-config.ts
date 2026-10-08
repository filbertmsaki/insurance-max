import { apiClient } from '@/modules/shared/api/client';
import type {
  TiramisSecretHealth,
  TiramisSecretReplacements,
} from '@/components/shared/TiramisSecretHealthCard';

export interface PlatformTiramisConfiguration {
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
  allowExpiredCertificates: boolean;
  notificationEvents?: string[] | null;
  integrationPermissions?: string[] | null;
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
  apiKeyStatus?: 'ACTIVE' | 'NOT_CONFIGURED' | 'RECOVERY_REQUIRED';
  notificationCredentialStatus?: string;
  isActive: boolean;
  validationStatus: 'NOT_VALIDATED' | 'VALID' | 'INVALID';
  validatedAt: string | null;
  validationMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GeneratedPlatformTiramisApiKeyResponse extends PlatformTiramisConfiguration {
  generatedApiKey?: string;
}

export interface UpsertPlatformTiramisConfigurationDto {
  company_code: string;
  insurer_company_code?: string;
  client_code?: string;
  /** The TIRA-issued client secret. Required the first time this
   * company/environment is linked; leave blank on later edits to keep it. */
  client_key?: string;
  system_code: string;
  system_name?: string;
  base_url?: string;
  source_service?: string;
  callback_url?: string;
  tiramis_service_api_key?: string;
  allow_expired_certificates?: boolean;
  notification_events?: string[];
  integration_permissions?: string[];
  is_active?: boolean;
  use_as_target_environment?: boolean;
  confirm_live_activation?: boolean;
  force_activation?: boolean;
}

/**
 * Platform-admin actions for linking a company to TIRAMIS on its behalf —
 * the company admin never touches this directly (see
 * modules/tenant/tiramis-config for their read-only view).
 */
export const platformTiramisConfigApi = {
  getConfigurations: (companyId: string) =>
    apiClient
      .get<
        PlatformTiramisConfiguration[]
      >(`/platform/companies/${companyId}/tiramis-configurations`)
      .then((r) => r.data),

  upsertConfiguration: (
    companyId: string,
    environment: 'test' | 'live',
    data: UpsertPlatformTiramisConfigurationDto,
  ) =>
    apiClient
      .put<PlatformTiramisConfiguration>(
        `/platform/companies/${companyId}/tiramis-configurations/${environment}`,
        data,
      )
      .then((r) => r.data),

  validateConfiguration: (
    companyId: string,
    environment: 'test' | 'live',
    data: {
      allow_expired_certificates?: boolean;
    } = {},
  ) =>
    apiClient
      .post<{
        valid: boolean;
        message?: string;
        warnings?: string[];
        errors?: string[];
      }>(
        `/platform/companies/${companyId}/tiramis-configurations/${environment}/validate`,
        data,
      )
      .then((r) => r.data),

  activateConfiguration: (
    companyId: string,
    environment: 'test' | 'live',
    data: {
      confirm_live_activation?: boolean;
      force_activation?: boolean;
    } = {},
  ) =>
    apiClient
      .post<PlatformTiramisConfiguration>(
        `/platform/companies/${companyId}/tiramis-configurations/${environment}/activate`,
        data,
      )
      .then((r) => r.data),

  getSecretHealth: (companyId: string, environment: 'test' | 'live') =>
    apiClient
      .get<TiramisSecretHealth>(
        `/platform/companies/${companyId}/tiramis-configurations/${environment}/secrets/health`,
      )
      .then((r) => r.data),

  repairSecrets: (
    companyId: string,
    environment: 'test' | 'live',
    replacements: TiramisSecretReplacements,
  ) =>
    apiClient
      .post<TiramisSecretHealth>(
        `/platform/companies/${companyId}/tiramis-configurations/${environment}/secrets/repair`,
        {
          client_key: replacements.clientKey,
          client_private_certificate_password:
            replacements.clientPrivateCertificatePassword,
          tira_public_certificate_password:
            replacements.tiraPublicCertificatePassword,
          portal_webhook_api_key: replacements.portalWebhookApiKey,
        },
      )
      .then((r) => r.data),

  generateApiKey: (companyId: string, environment: 'test' | 'live', allowed_ips: string[]) =>
    apiClient
      .post<GeneratedPlatformTiramisApiKeyResponse>(
        `/platform/companies/${companyId}/tiramis-configurations/${environment}/api-key/generate`,
        { allowed_ips },
      )
      .then((r) => r.data),
};
