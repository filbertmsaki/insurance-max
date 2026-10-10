import { registerAs } from '@nestjs/config';
import { join } from 'path';

import { buildUrl, normalizeBaseUrl } from '@insurance-max/shared-config';
import {
  isProductionEnvironment,
  optionalBooleanEnv,
  optionalNumberEnv,
  optionalNumberListEnv,
  optionalStringEnv,
  TIRAMIS_DEFAULTS,
} from './tiramis-defaults';

export default registerAs('tiramisService', () => {
  const appUrl = normalizeBaseUrl(
    process.env.APP_URL || 'http://localhost:9091',
  );

  const globalPrefix = process.env.APP_GLOBAL_PREFIX || 'api';
  const productionEnvironment = isProductionEnvironment();
  const tiraEnv = process.env.TIRA_ENV?.trim() || 'local';

  return {
    url: appUrl,

    apiBaseUrl: buildUrl(appUrl, globalPrefix),

    tiraEnv,

    baseUrl: normalizeBaseUrl(process.env.TIRAMIS_BASE_URL || ''),

    callbackUrl: process.env.TIRAMIS_CALLBACK_URL?.trim() || '',

    requestTimeoutMs: optionalNumberEnv(
      'TIRAMIS_HTTP_TIMEOUT_MS',
      TIRAMIS_DEFAULTS.requestTimeoutMs,
    ),

    logPayloads: optionalBooleanEnv(
      'TIRAMIS_LOG_PAYLOADS',
      TIRAMIS_DEFAULTS.logPayloads,
    ),

    requestLogEnabled: optionalBooleanEnv(
      'TIRAMIS_REQUEST_LOG_ENABLED',
      TIRAMIS_DEFAULTS.requestLogEnabled,
    ),
    requestLogRedactXml: optionalBooleanEnv(
      'TIRAMIS_REQUEST_LOG_REDACT_XML',
      TIRAMIS_DEFAULTS.requestLogRedactXml,
    ),
    requestLogRedactedXmlTags: optionalStringEnv(
      'TIRAMIS_REQUEST_LOG_REDACTED_XML_TAGS',
      TIRAMIS_DEFAULTS.requestLogRedactedXmlTags,
    ),
    requestLogDir:
      process.env.TIRAMIS_REQUEST_LOG_DIR?.trim() ||
      join(
        process.env.TIRAMIS_CALLBACK_ERROR_LOG_DIR?.trim() ||
          (process.env.APP_ENV === 'production' ||
          process.env.NODE_ENV === 'production'
            ? '/opt/apps/tiramis/shared'
            : join(process.cwd(), 'logs')),
        'tira-requests',
      ),
    callbackDeadLetterRawXmlMode: optionalStringEnv(
      'TIRAMIS_CALLBACK_DEAD_LETTER_RAW_XML_MODE',
      TIRAMIS_DEFAULTS.callbackDeadLetterRawXmlMode,
    ),
    callbackDiagnosticsRetentionEnabled: optionalBooleanEnv(
      'TIRAMIS_CALLBACK_DIAGNOSTICS_RETENTION_ENABLED',
      TIRAMIS_DEFAULTS.callbackDiagnosticsRetentionEnabled,
    ),
    callbackDiagnosticsRetentionDays: optionalNumberEnv(
      'TIRAMIS_CALLBACK_DIAGNOSTICS_RETENTION_DAYS',
      TIRAMIS_DEFAULTS.callbackDiagnosticsRetentionDays,
    ),

    portalNotifyEnabled: optionalBooleanEnv(
      'TIRAMIS_PORTAL_NOTIFY_ENABLED',
      TIRAMIS_DEFAULTS.portalNotifyEnabled,
    ),

    portalWebhookTimeoutMs: optionalNumberEnv(
      'INSURANCE_PORTAL_WEBHOOK_TIMEOUT_MS',
      TIRAMIS_DEFAULTS.portalWebhookTimeoutMs,
    ),
    portalWebhookMaxAttempts: optionalNumberEnv(
      'TIRAMIS_PORTAL_WEBHOOK_MAX_ATTEMPTS',
      TIRAMIS_DEFAULTS.portalWebhookMaxAttempts,
    ),
    portalWebhookRetryDelaysSeconds: optionalNumberListEnv(
      'TIRAMIS_PORTAL_WEBHOOK_RETRY_DELAYS_SECONDS',
      TIRAMIS_DEFAULTS.portalWebhookRetryDelaysSeconds,
    ),
    portalWebhookAllowedHosts:
      process.env.TIRAMIS_PORTAL_WEBHOOK_ALLOWED_HOSTS?.trim() || '',
    portalWebhookRequireHttps: optionalBooleanEnv(
      'TIRAMIS_PORTAL_WEBHOOK_REQUIRE_HTTPS',
      productionEnvironment,
    ),
    portalWebhookBlockPrivateIps: optionalBooleanEnv(
      'TIRAMIS_PORTAL_WEBHOOK_BLOCK_PRIVATE_IPS',
      productionEnvironment,
    ),
    portalWebhookSigningSecret:
      process.env.TIRAMIS_PORTAL_WEBHOOK_SIGNING_SECRET?.trim() || '',
    portalOutboxBatchSize: optionalNumberEnv(
      'TIRAMIS_PORTAL_OUTBOX_BATCH_SIZE',
      TIRAMIS_DEFAULTS.portalOutboxBatchSize,
    ),
    portalOutboxIntervalMs: optionalNumberEnv(
      'TIRAMIS_PORTAL_OUTBOX_INTERVAL_MS',
      TIRAMIS_DEFAULTS.portalOutboxIntervalMs,
    ),

    retryEnabled: optionalBooleanEnv(
      'TIRAMIS_RETRY_ENABLED',
      TIRAMIS_DEFAULTS.retryEnabled,
    ),
    retryBatchSize: optionalNumberEnv(
      'TIRAMIS_RETRY_BATCH_SIZE',
      TIRAMIS_DEFAULTS.retryBatchSize,
    ),
    retryMaxAttempts: optionalNumberEnv(
      'TIRAMIS_RETRY_MAX_ATTEMPTS',
      TIRAMIS_DEFAULTS.retryMaxAttempts,
    ),
    retryBaseDelaySeconds: optionalNumberEnv(
      'TIRAMIS_RETRY_BASE_DELAY_SECONDS',
      TIRAMIS_DEFAULTS.retryBaseDelaySeconds,
    ),
    retryMaxDelaySeconds: optionalNumberEnv(
      'TIRAMIS_RETRY_MAX_DELAY_SECONDS',
      TIRAMIS_DEFAULTS.retryMaxDelaySeconds,
    ),
    finalCallbackTimeoutMinutes: optionalNumberEnv(
      'TIRAMIS_FINAL_CALLBACK_TIMEOUT_MINUTES',
      TIRAMIS_DEFAULTS.finalCallbackTimeoutMinutes,
    ),
    legacyRawApiKeysEnabled: optionalBooleanEnv(
      'TIRAMIS_LEGACY_RAW_API_KEYS_ENABLED',
      TIRAMIS_DEFAULTS.legacyRawApiKeysEnabled,
    ),
    internalCallbackTestsEnabled: optionalBooleanEnv(
      'TIRAMIS_INTERNAL_CALLBACK_TESTS_ENABLED',
      TIRAMIS_DEFAULTS.internalCallbackTestsEnabled,
    ),
  };
});
