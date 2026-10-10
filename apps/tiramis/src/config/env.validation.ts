import * as Joi from 'joi';

import { TIRAMIS_DEFAULTS } from './tiramis-defaults';

function optionalBoolean(defaultValue: boolean) {
  return Joi.any()
    .custom((value, helpers) => {
      if (
        value === undefined ||
        value === null ||
        String(value).trim() === ''
      ) {
        return defaultValue;
      }

      const normalized = String(value).trim().toLowerCase();

      if (['true', '1', 'yes', 'on'].includes(normalized)) {
        return true;
      }

      if (['false', '0', 'no', 'off'].includes(normalized)) {
        return false;
      }

      return helpers.error('any.invalid');
    })
    .default(defaultValue);
}

function optionalInteger(
  defaultValue: number,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
) {
  return Joi.any()
    .custom((value, helpers) => {
      if (
        value === undefined ||
        value === null ||
        String(value).trim() === ''
      ) {
        return defaultValue;
      }

      const parsed = Number(String(value).trim());

      if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
        return helpers.error('number.integer');
      }

      return parsed;
    })
    .default(defaultValue);
}

function optionalString(defaultValue = '') {
  return Joi.string().trim().empty('').default(defaultValue);
}

function optionalNumberList(defaultValue: number[], min = 0) {
  return Joi.any()
    .custom((value, helpers) => {
      if (
        value === undefined ||
        value === null ||
        String(value).trim() === ''
      ) {
        return defaultValue;
      }

      const values = String(value)
        .split(',')
        .map((entry) => Number(entry.trim()));

      if (
        !values.length ||
        values.some((entry) => !Number.isFinite(entry) || entry < min)
      ) {
        return helpers.error('any.invalid');
      }

      return values;
    })
    .default(defaultValue);
}

const requiredValue = () => Joi.string().trim().min(1).required();

export const tiramisEnvValidationSchema = Joi.object({
  APP_NAME: Joi.string().trim().min(1).default('Alliance Platform'),
  APP_ENV: Joi.string()
    .valid('local', 'development', 'test', 'uat', 'staging', 'production')
    .default('development'),
  APP_HOST: Joi.string().trim().min(1).default('0.0.0.0'),
  APP_PORT: Joi.number().integer().min(1).max(65535).default(9091),
  APP_GLOBAL_PREFIX: Joi.string()
    .trim()
    .pattern(/^[^/]+(?:\/[^/]+)*$/)
    .default('api'),
  APP_VERSION: Joi.string().default('v1'),
  APP_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .required(),
  TIRAMIS_TRUSTED_PROXY_IPS: Joi.string().allow('').default(''),
  PORTAL_ADMIN_JWT_ACCESS_SECRET: Joi.when('APP_ENV', {
    is: 'production',
    then: Joi.string().min(32).required(),
    otherwise: Joi.string().allow('').default(''),
  }),
  PORTAL_ADMIN_JWT_ISSUER: Joi.string().default('insurance-idp.tz'),
  PORTAL_ADMIN_JWT_AUDIENCE: Joi.string().default('insurance-platform'),
  PORTAL_ADMIN_SESSION_VALIDATION_ENABLED: Joi.boolean().default(false),
  PORTAL_ADMIN_SESSION_INTROSPECTION_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .allow('')
    .default(''),
  PORTAL_ADMIN_REQUIRED_PERMISSIONS: Joi.string().allow('').default(''),
  PORTAL_ADMIN_MFA_MAX_AGE_MINUTES: Joi.number().integer().min(0).default(0),
  PORTAL_ADMIN_RATE_LIMIT_MAX: Joi.number().integer().min(0).default(60),
  PORTAL_ADMIN_RATE_LIMIT_WINDOW_MS: Joi.number()
    .integer()
    .min(1000)
    .default(60000),
  // Selects this server's one active TIRA integration environment.
  TIRA_ENV: Joi.string().valid('uat', 'production').default('uat'),
  DB_TYPE: Joi.string()
    .valid('postgres', 'mysql', 'oracle')
    .default('postgres'),
  DB_HOST: Joi.string().default('localhost'),
  DB_PORT: Joi.number().default(5432),
  DB_USERNAME: Joi.string().default('postgres'),
  DB_PASSWORD: Joi.when('APP_ENV', {
    is: 'production',
    then: Joi.string().min(1).required(),
    otherwise: Joi.string().allow('').default(''),
  }),
  DB_DATABASE: Joi.string().default('alliance_db'),
  DB_ORACLE_CONNECT_STRING: Joi.string().allow('').default(''),
  DB_SYNCHRONIZE: Joi.boolean().default(false),
  DB_LOGGING: Joi.boolean().default(false),
  DB_SSL: Joi.boolean().default(false),

  LOGGER_ENABLED: Joi.boolean().default(true),
  LOGGER_LEVEL: Joi.string().default('log,error,warn,debug,verbose'),
  TIRAMIS_SECRET_ENCRYPTION_KEY: Joi.string().required(),
  TIRAMIS_SECRET_ENCRYPTION_KEY_PREVIOUS: Joi.string().allow('').optional(),
  TIRAMIS_CERTIFICATE_BASE_DIR: Joi.string().default(
    '/opt/apps/tiramis/certificates',
  ),
  TIRAMIS_CERTIFICATE_EXPIRY_WARNING_DAYS: Joi.number().default(30),
  // Platform-wide TIRA system identity for this server's active TIRA_ENV.
  TIRA_CLIENT_CODE: requiredValue(),
  TIRA_CLIENT_KEY: requiredValue(),
  TIRA_SYSTEM_CODE: requiredValue(),
  TIRA_SYSTEM_NAME: Joi.string().allow('').default(''),
  TIRA_CLIENT_CERT_PASSWORD: requiredValue(),
  TIRA_PUBLIC_CERT_PASSWORD: requiredValue(),
  TIRA_ALLOW_EXPIRED_CERTIFICATES: optionalBoolean(false),
  TIRA_SIGNATURE_ALGORITHM: Joi.string()
    .trim()
    .default('sha1WithRSAEncryption'),
  TIRAMIS_BASE_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .required(),

  TIRAMIS_PORTAL_NOTIFY_ENABLED: optionalBoolean(
    TIRAMIS_DEFAULTS.portalNotifyEnabled,
  ),
  INSURANCE_PORTAL_WEBHOOK_TIMEOUT_MS: optionalInteger(
    TIRAMIS_DEFAULTS.portalWebhookTimeoutMs,
    1000,
    300000,
  ),
  TIRAMIS_PORTAL_WEBHOOK_MAX_ATTEMPTS: optionalInteger(
    TIRAMIS_DEFAULTS.portalWebhookMaxAttempts,
    1,
  ),
  TIRAMIS_PORTAL_WEBHOOK_RETRY_DELAYS_SECONDS: optionalNumberList(
    TIRAMIS_DEFAULTS.portalWebhookRetryDelaysSeconds,
    1,
  ),
  TIRAMIS_PORTAL_WEBHOOK_ALLOWED_HOSTS: Joi.string().allow('').default(''),
  TIRAMIS_PORTAL_WEBHOOK_REQUIRE_HTTPS: Joi.when('APP_ENV', {
    is: 'production',
    then: optionalBoolean(true),
    otherwise: optionalBoolean(false),
  }),
  TIRAMIS_PORTAL_WEBHOOK_BLOCK_PRIVATE_IPS: Joi.when('APP_ENV', {
    is: 'production',
    then: optionalBoolean(true),
    otherwise: optionalBoolean(false),
  }),
  TIRAMIS_PORTAL_WEBHOOK_SIGNING_SECRET: Joi.when('APP_ENV', {
    is: 'production',
    then: Joi.string().min(32).allow('').default(''),
    otherwise: Joi.string().allow('').default(''),
  }),
  TIRAMIS_PORTAL_OUTBOX_BATCH_SIZE: optionalInteger(
    TIRAMIS_DEFAULTS.portalOutboxBatchSize,
    1,
  ),
  TIRAMIS_PORTAL_OUTBOX_INTERVAL_MS: optionalInteger(
    TIRAMIS_DEFAULTS.portalOutboxIntervalMs,
    1000,
  ),

  TIRAMIS_HTTP_TIMEOUT_MS: optionalInteger(
    TIRAMIS_DEFAULTS.requestTimeoutMs,
    1000,
    300000,
  ),
  TIRAMIS_LOG_PAYLOADS: optionalBoolean(TIRAMIS_DEFAULTS.logPayloads),
  TIRAMIS_REQUEST_LOG_ENABLED: optionalBoolean(
    TIRAMIS_DEFAULTS.requestLogEnabled,
  ),
  TIRAMIS_REQUEST_LOG_REDACT_XML: optionalBoolean(
    TIRAMIS_DEFAULTS.requestLogRedactXml,
  ),
  TIRAMIS_REQUEST_LOG_REDACTED_XML_TAGS: optionalString(
    TIRAMIS_DEFAULTS.requestLogRedactedXmlTags,
  ),
  TIRAMIS_REQUEST_LOG_DIR: Joi.string().trim().min(1).optional(),
  TIRAMIS_CALLBACK_DEAD_LETTER_RAW_XML_MODE: optionalString(
    TIRAMIS_DEFAULTS.callbackDeadLetterRawXmlMode,
  ).valid('full', 'redacted', 'off'),
  TIRAMIS_CALLBACK_DIAGNOSTICS_RETENTION_ENABLED: optionalBoolean(
    TIRAMIS_DEFAULTS.callbackDiagnosticsRetentionEnabled,
  ),
  TIRAMIS_CALLBACK_DIAGNOSTICS_RETENTION_DAYS: optionalInteger(
    TIRAMIS_DEFAULTS.callbackDiagnosticsRetentionDays,
    1,
  ),
  TIRAMIS_LEGACY_RAW_API_KEYS_ENABLED: optionalBoolean(
    TIRAMIS_DEFAULTS.legacyRawApiKeysEnabled,
  ),
  TIRAMIS_RETRY_ENABLED: optionalBoolean(TIRAMIS_DEFAULTS.retryEnabled),
  TIRAMIS_RETRY_BATCH_SIZE: optionalInteger(TIRAMIS_DEFAULTS.retryBatchSize, 1),
  TIRAMIS_RETRY_MAX_ATTEMPTS: optionalInteger(
    TIRAMIS_DEFAULTS.retryMaxAttempts,
    1,
  ),
  TIRAMIS_RETRY_BASE_DELAY_SECONDS: optionalInteger(
    TIRAMIS_DEFAULTS.retryBaseDelaySeconds,
    1,
  ),
  TIRAMIS_RETRY_MAX_DELAY_SECONDS: optionalInteger(
    TIRAMIS_DEFAULTS.retryMaxDelaySeconds,
    1,
  ),
  TIRAMIS_FINAL_CALLBACK_TIMEOUT_MINUTES: optionalInteger(
    TIRAMIS_DEFAULTS.finalCallbackTimeoutMinutes,
    1,
  ),
  TIRAMIS_INTERNAL_CALLBACK_TESTS_ENABLED: optionalBoolean(
    TIRAMIS_DEFAULTS.internalCallbackTestsEnabled,
  ),
  // Directory for tiramis_callback_error.log. Must be a path that survives
  // deploys (e.g. /opt/apps/tiramis/shared) — PM2's cwd is a per-release
  // directory that gets replaced on every release. Defaults to cwd for local dev.
  TIRAMIS_CALLBACK_ERROR_LOG_DIR: Joi.string().optional(),
});
