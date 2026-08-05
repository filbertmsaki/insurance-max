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

    requestTimeoutMs: Number(process.env.TIRAMIS_HTTP_TIMEOUT_MS || 60000),

    logPayloads: process.env.TIRAMIS_LOG_PAYLOADS === 'true',

    portalNotifyEnabled: process.env.TIRAMIS_PORTAL_NOTIFY_ENABLED !== 'false',

    portalWebhookUrl: process.env.INSURANCE_PORTAL_WEBHOOK_URL?.trim() || '',

    portalWebhookTimeoutMs: Number(
      process.env.INSURANCE_PORTAL_WEBHOOK_TIMEOUT_MS || 5000,
    ),

    sourceService: process.env.TIRAMIS_SOURCE_SERVICE || 'tiramis-service',
  };
});
