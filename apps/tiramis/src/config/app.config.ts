import { registerAs } from '@nestjs/config';

import { buildUrl, normalizeBaseUrl } from '@insurance-max/shared-config';

export default registerAs('tiramisService', () => {
  const appUrl = normalizeBaseUrl(
    process.env.APP_URL || 'http://localhost:9091',
  );

  const globalPrefix = process.env.APP_GLOBAL_PREFIX || 'api';

  return {
    url: appUrl,

    apiBaseUrl: buildUrl(appUrl, globalPrefix),

    testBaseUrl: normalizeBaseUrl(process.env.TIRAMIS_TEST_BASE_URL || ''),

    liveBaseUrl: normalizeBaseUrl(process.env.TIRAMIS_LIVE_BASE_URL || ''),

    testCallbackUrl: process.env.TIRAMIS_TEST_CALLBACK_URL?.trim() || '',

    liveCallbackUrl: process.env.TIRAMIS_LIVE_CALLBACK_URL?.trim() || '',

    requestTimeoutMs: Number(process.env.TIRAMIS_HTTP_TIMEOUT_MS || 60000),

    logPayloads: process.env.TIRAMIS_LOG_PAYLOADS === 'true',

    portalNotifyEnabled: process.env.TIRAMIS_PORTAL_NOTIFY_ENABLED !== 'false',

    portalWebhookUrl: process.env.INSURANCE_PORTAL_WEBHOOK_URL?.trim() || '',

    portalWebhookTimeoutMs: Number(
      process.env.INSURANCE_PORTAL_WEBHOOK_TIMEOUT_MS || 5000,
    ),

    portalEventUrl:
      process.env.INSURANCE_PORTAL_EVENT_URL?.trim() ||
      'http://127.0.0.1:9090/api/v1/internal/tiramis/events',
    portalEventOutboxEnabled:
      process.env.TIRAMIS_PORTAL_EVENT_OUTBOX_ENABLED !== 'false',
    portalEventBatchSize: Number(
      process.env.TIRAMIS_PORTAL_EVENT_BATCH_SIZE || 50,
    ),
    portalEventMaxAttempts: Number(
      process.env.TIRAMIS_PORTAL_EVENT_MAX_ATTEMPTS || 12,
    ),
    portalEventBaseDelaySeconds: Number(
      process.env.TIRAMIS_PORTAL_EVENT_BASE_DELAY_SECONDS || 30,
    ),
    portalEventMaxDelaySeconds: Number(
      process.env.TIRAMIS_PORTAL_EVENT_MAX_DELAY_SECONDS || 1800,
    ),
    retryEnabled: process.env.TIRAMIS_RETRY_ENABLED !== 'false',
    retryBatchSize: Number(process.env.TIRAMIS_RETRY_BATCH_SIZE || 20),
    retryMaxAttempts: Number(process.env.TIRAMIS_RETRY_MAX_ATTEMPTS || 5),
    retryBaseDelaySeconds: Number(
      process.env.TIRAMIS_RETRY_BASE_DELAY_SECONDS || 60,
    ),
    retryMaxDelaySeconds: Number(
      process.env.TIRAMIS_RETRY_MAX_DELAY_SECONDS || 900,
    ),
    finalCallbackTimeoutMinutes: Number(
      process.env.TIRAMIS_FINAL_CALLBACK_TIMEOUT_MINUTES || 30,
    ),
    legacyPortalWebhookTokenEnabled:
      process.env.TIRAMIS_LEGACY_PORTAL_WEBHOOK_TOKEN_ENABLED === 'true',
  };
});
