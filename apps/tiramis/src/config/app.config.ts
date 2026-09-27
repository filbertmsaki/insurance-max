import { registerAs } from '@nestjs/config';
import { join } from 'path';

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

    targetEnvironment: process.env.TIRAMIS_TARGET_ENV?.trim() || 'test',

    requestTimeoutMs: Number(process.env.TIRAMIS_HTTP_TIMEOUT_MS || 60000),

    logPayloads: process.env.TIRAMIS_LOG_PAYLOADS === 'true',

    requestLogEnabled: process.env.TIRAMIS_REQUEST_LOG_ENABLED !== 'false',
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

    portalNotifyEnabled: process.env.TIRAMIS_PORTAL_NOTIFY_ENABLED !== 'false',

    portalWebhookTimeoutMs: Number(
      process.env.INSURANCE_PORTAL_WEBHOOK_TIMEOUT_MS || 5000,
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
  };
});
