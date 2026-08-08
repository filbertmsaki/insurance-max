export const SecurityPolicyStatus = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  SUPERSEDED: 'SUPERSEDED',
  RETIRED: 'RETIRED',
} as const;

export type SecurityPolicyStatus =
  (typeof SecurityPolicyStatus)[keyof typeof SecurityPolicyStatus];

export const AuthenticationStrength = {
  PASSWORD: 'PASSWORD',
  PASSWORD_OTP: 'PASSWORD_OTP',
  PASSWORD_TOTP: 'PASSWORD_TOTP',
  SERVICE_JWT: 'SERVICE_JWT',
  API_KEY: 'API_KEY',
  SERVICE_JWT_API_KEY: 'SERVICE_JWT_API_KEY',
} as const;

export type AuthenticationStrength =
  (typeof AuthenticationStrength)[keyof typeof AuthenticationStrength];

export const SecurityRiskLevel = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
} as const;

export type SecurityRiskLevel =
  (typeof SecurityRiskLevel)[keyof typeof SecurityRiskLevel];

export const ApiClientStatus = {
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  ROTATING: 'ROTATING',
  REVOKED: 'REVOKED',
  EXPIRED: 'EXPIRED',
  COMPROMISED: 'COMPROMISED',
} as const;

export type ApiClientStatus =
  (typeof ApiClientStatus)[keyof typeof ApiClientStatus];

export const ApiClientType = {
  INTERNAL_SERVICE: 'INTERNAL_SERVICE',
  EXTERNAL_PARTNER: 'EXTERNAL_PARTNER',
  TENANT_INTEGRATION: 'TENANT_INTEGRATION',
} as const;

export type ApiClientType = (typeof ApiClientType)[keyof typeof ApiClientType];

export const AuditEventSeverity = {
  INFO: 'INFO',
  WARNING: 'WARNING',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
} as const;

export type AuditEventSeverity =
  (typeof AuditEventSeverity)[keyof typeof AuditEventSeverity];

export const DataRetentionAction = {
  RETAIN: 'RETAIN',
  ARCHIVE: 'ARCHIVE',
  ANONYMIZE: 'ANONYMIZE',
  DELETE: 'DELETE',
} as const;

export type DataRetentionAction =
  (typeof DataRetentionAction)[keyof typeof DataRetentionAction];

export const DataRetentionStatus = {
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  RETIRED: 'RETIRED',
} as const;

export type DataRetentionStatus =
  (typeof DataRetentionStatus)[keyof typeof DataRetentionStatus];

export const DeploymentEnvironment = {
  DEVELOPMENT: 'DEVELOPMENT',
  TEST: 'TEST',
  UAT: 'UAT',
  STAGING: 'STAGING',
  PRODUCTION: 'PRODUCTION',
} as const;

export type DeploymentEnvironment =
  (typeof DeploymentEnvironment)[keyof typeof DeploymentEnvironment];
