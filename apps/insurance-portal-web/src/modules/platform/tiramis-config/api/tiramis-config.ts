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
  notificationEvents?: string[] | null;
  integrationPermissions?: string[] | null;
  effectiveBaseUrl?: string | null;
  effectiveSourceService?: string | null;
  effectiveTargetEnvironment?: 'test' | 'live';
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

/** Platform-wide TIRA system identity (TIRAMIS server environment, read-only). */
export interface TiramisSystemIdentity {
  environment: 'test' | 'live';
  clientCode: string | null;
  systemCode: string | null;
  systemName: string | null;
  baseUrl: string | null;
  callbackBaseUrl: string | null;
}

export interface TiramisValidationResult {
  valid: boolean;
  message?: string;
  allowExpiredCertificates?: boolean;
  systemCode?: string | null;
  systemName?: string | null;
  clientCode?: string | null;
  baseUrl?: string | null;
  callback?: unknown;
  certificates?: unknown;
  warnings?: string[];
  errors?: string[];
}

export interface UpsertPlatformTiramisConfigurationDto {
  company_code: string;
  insurer_company_code?: string;
  /** Default TIRA sale point, used only when a request has no branch sale point. */
  sale_point_code?: string;
  /** Defaults to the insurer company code. */
  tran_company_code?: string;
  tiramis_service_api_key?: string;
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

  getSystemIdentity: (companyId: string, environment: 'test' | 'live') =>
    apiClient
      .get<TiramisSystemIdentity>(
        `/platform/companies/${companyId}/tiramis-configurations/${environment}/system-identity`,
      )
      .then((r) => r.data),

  validateConfiguration: (
    companyId: string,
    environment: 'test' | 'live',
    /** One-off override for this validation call only; never stored. */
    data: {
      allow_expired_certificates?: boolean;
    } = {},
  ) =>
    apiClient
      .post<TiramisValidationResult>(
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
        { portal_webhook_api_key: replacements.portalWebhookApiKey },
      )
      .then((r) => r.data),

  generateApiKey: (
    companyId: string,
    environment: 'test' | 'live',
    allowed_ips: string[],
  ) =>
    apiClient
      .post<GeneratedPlatformTiramisApiKeyResponse>(
        `/platform/companies/${companyId}/tiramis-configurations/${environment}/api-key/generate`,
        { allowed_ips },
      )
      .then((r) => r.data),
};
