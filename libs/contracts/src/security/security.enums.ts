export enum SecurityPolicyStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  SUPERSEDED = 'SUPERSEDED',
  RETIRED = 'RETIRED',
}

export enum AuthenticationStrength {
  PASSWORD = 'PASSWORD',
  PASSWORD_OTP = 'PASSWORD_OTP',
  PASSWORD_TOTP = 'PASSWORD_TOTP',
  SERVICE_JWT = 'SERVICE_JWT',
  API_KEY = 'API_KEY',
  SERVICE_JWT_API_KEY = 'SERVICE_JWT_API_KEY',
}

export enum SecurityRiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum ApiClientStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  ROTATING = 'ROTATING',
  REVOKED = 'REVOKED',
  EXPIRED = 'EXPIRED',
  COMPROMISED = 'COMPROMISED',
}

export enum ApiClientType {
  INTERNAL_SERVICE = 'INTERNAL_SERVICE',
  EXTERNAL_PARTNER = 'EXTERNAL_PARTNER',
  TENANT_INTEGRATION = 'TENANT_INTEGRATION',
}

export enum AuditEventSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum DataRetentionAction {
  RETAIN = 'RETAIN',
  ARCHIVE = 'ARCHIVE',
  ANONYMIZE = 'ANONYMIZE',
  DELETE = 'DELETE',
}

export enum DataRetentionStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  RETIRED = 'RETIRED',
}

export enum DeploymentEnvironment {
  DEVELOPMENT = 'DEVELOPMENT',
  TEST = 'TEST',
  UAT = 'UAT',
  STAGING = 'STAGING',
  PRODUCTION = 'PRODUCTION',
}
