import { apiClient } from '@/modules/shared/api/client';

export type TiramisEnvironment = 'test' | 'live';
export type TiramisValidationStatus = 'NOT_VALIDATED' | 'VALID' | 'INVALID';
export type TiramisFieldSource =
  | 'profile'
  | 'environment'
  | 'default'
  | 'missing';
export type TiramisIntegrationPermission =
  | 'submit'
  | 'read_status'
  | 'receive_notifications';
export type TiramisLinkStatus = 'LINKED' | 'ACTIVE' | 'REVOKED';
export type TiramisCertificateKind = 'clientPrivate' | 'tiraPublic';

export const TIRAMIS_ENVIRONMENTS: TiramisEnvironment[] = ['test', 'live'];

export const TIRAMIS_ENVIRONMENT_LABELS: Record<TiramisEnvironment, string> = {
  test: 'Test',
  live: 'Production',
};

export const TIRAMIS_INTEGRATION_PERMISSIONS: TiramisIntegrationPermission[] = [
  'submit',
  'read_status',
  'receive_notifications',
];

export const TIRAMIS_NOTIFICATION_EVENTS: string[] = [
  'TIRAMIS_ACK_RECEIVED',
  'TIRAMIS_ACK_FAILED',
  'TIRAMIS_FINAL_RESPONSE_RECEIVED',
  'TIRAMIS_FINAL_SUCCESS',
  'TIRAMIS_FINAL_FAILED',
  'TIRAMIS_FINAL_CALLBACK_OVERDUE',
  'TIRAMIS_RESPONSE_ACK_SENT',
  'TIRAMIS_CALLBACK_REJECTED',
  'TIRAMIS_SUBMISSION_FAILED',
];

export const TIRAMIS_PERMISSIONS = {
  read: 'platform:tiramis-integration:read',
  manage: 'platform:tiramis-integration:manage',
  switchEnvironment: 'platform:tiramis-integration:switch-environment',
  companyAccess: 'platform:tiramis-integration:company-access',
} as const;

export interface TiramisEnvironmentSummary {
  validationStatus: TiramisValidationStatus;
  validatedAt: string | null;
  serviceApiKeyConfigured: boolean;
  pendingSubmissions: number;
}

export interface TiramisProfile {
  environment: TiramisEnvironment;
  clientCode: string | null;
  clientKeyMasked: string | null;
  systemCode: string | null;
  systemName: string | null;
  baseUrl: string | null;
  callbackUrl: string | null;
  clientCertificatePath: string | null;
  clientCertificatePasswordConfigured: boolean;
  publicCertificatePath: string | null;
  publicCertificatePasswordConfigured: boolean;
  signatureAlgorithm: string | null;
  allowExpiredCertificates: boolean;
  portalWebhookApiKeyConfigured: boolean;
  portalNotificationEvents: string[] | null;
  sources: Record<string, TiramisFieldSource>;
  validationStatus: TiramisValidationStatus;
  validatedAt: string | null;
  validationMessage: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface TiramisIntegrationOverview {
  activeEnvironment: TiramisEnvironment;
  environmentSwitchedAt: string | null;
  integrationPermissions: string[];
  environments: Record<TiramisEnvironment, TiramisEnvironmentSummary>;
  profiles: Record<TiramisEnvironment, TiramisProfile> | { error: string };
  companies: Partial<Record<TiramisLinkStatus, number>>;
}

export interface TiramisProfileUpdate {
  clientCode?: string;
  clientKey?: string;
  systemCode?: string;
  systemName?: string;
  baseUrl?: string;
  callbackUrl?: string;
  clientCertificatePassword?: string;
  publicCertificatePassword?: string;
  signatureAlgorithm?: string;
  allowExpiredCertificates?: boolean;
  portalNotificationEvents?: string[];
}

export interface TiramisValidationResult {
  valid: boolean;
  message: string;
  errors?: string[];
  warnings?: string[];
  certificates?: unknown;
}

export interface TiramisCompanyLink {
  id: string;
  companyId: string;
  companyName: string;
  insurerCompanyCode: string;
  insurerCompanyName: string | null;
  status: TiramisLinkStatus;
  linkedAt: string | null;
  activatedAt: string | null;
  revokedAt: string | null;
  revokeReason: string | null;
  restoredAt: string | null;
}

export interface TiramisCompanyAccess {
  companyId: string;
  companyName: string;
  companyStatus: string;
  suggestedInsurerCompanyCode: string | null;
  link: TiramisCompanyLink | null;
}

export function hasProfiles(
  profiles: TiramisIntegrationOverview['profiles'] | undefined,
): profiles is Record<TiramisEnvironment, TiramisProfile> {
  return Boolean(profiles && !('error' in profiles));
}

const BASE = '/platform/tiramis-integration';

export const tiramisIntegrationApi = {
  getOverview: () =>
    apiClient.get<TiramisIntegrationOverview>(BASE).then((r) => r.data),

  updateProfile: (env: TiramisEnvironment, data: TiramisProfileUpdate) =>
    apiClient
      .put<TiramisProfile>(`${BASE}/profiles/${env}`, data)
      .then((r) => r.data),

  uploadCertificate: (
    env: TiramisEnvironment,
    data: {
      kind: TiramisCertificateKind;
      contentBase64: string;
      password?: string;
    },
  ) =>
    apiClient
      .post<TiramisProfile>(`${BASE}/profiles/${env}/certificates`, data)
      .then((r) => r.data),

  validate: (env: TiramisEnvironment) =>
    apiClient
      .post<TiramisValidationResult>(`${BASE}/profiles/${env}/validate`)
      .then((r) => r.data),

  generateServiceApiKey: (env: TiramisEnvironment, allowedIps: string[]) =>
    apiClient
      .post<{
        environment: TiramisEnvironment;
        serviceApiKeyConfigured: boolean;
      }>(`${BASE}/profiles/${env}/service-api-key`, { allowedIps })
      .then((r) => r.data),

  rotateWebhookApiKey: (env: TiramisEnvironment) =>
    apiClient
      .post<{
        environment: TiramisEnvironment;
        portalWebhookApiKeyConfigured: boolean;
      }>(`${BASE}/profiles/${env}/webhook-api-key`)
      .then((r) => r.data),

  updateSettings: (data: {
    integrationPermissions?: TiramisIntegrationPermission[];
  }) =>
    apiClient
      .put<TiramisIntegrationOverview>(`${BASE}/settings`, data)
      .then((r) => r.data),

  switchEnvironment: (environment: TiramisEnvironment, confirmLive?: boolean) =>
    apiClient
      .post<TiramisIntegrationOverview>(`${BASE}/environment`, {
        environment,
        ...(confirmLive ? { confirmLive: true } : {}),
      })
      .then((r) => r.data),

  listCompanies: () =>
    apiClient
      .get<TiramisCompanyAccess[]>(`${BASE}/companies`)
      .then((r) => r.data),

  linkCompany: (
    companyId: string,
    data: { insurerCompanyCode: string; insurerCompanyName?: string },
  ) =>
    apiClient
      .put<TiramisCompanyLink>(`${BASE}/companies/${companyId}/link`, data)
      .then((r) => r.data),

  activateCompany: (companyId: string) =>
    apiClient
      .post<TiramisCompanyLink>(`${BASE}/companies/${companyId}/activate`)
      .then((r) => r.data),

  revokeCompany: (companyId: string, reason: string) =>
    apiClient
      .post<
        TiramisCompanyLink & { pendingSubmissions: number }
      >(`${BASE}/companies/${companyId}/revoke`, { reason })
      .then((r) => r.data),

  restoreCompany: (companyId: string) =>
    apiClient
      .post<TiramisCompanyLink>(`${BASE}/companies/${companyId}/restore`)
      .then((r) => r.data),
};

/** Reads a File into a base64 string (without the data: URL prefix). */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () =>
      reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/** Parses a comma/whitespace-separated list of IP addresses. */
export function parseIpList(value: string): string[] {
  return value
    .split(/[\s,]+/)
    .map((ip) => ip.trim())
    .filter(Boolean);
}
