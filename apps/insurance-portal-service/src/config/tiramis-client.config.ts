import { registerAs } from '@nestjs/config';

import { normalizeBaseUrl } from '@insurance-max/shared-config';

export default registerAs('tiramisClient', () => ({
  baseUrl: normalizeBaseUrl(
    process.env.TIRAMIS_SERVICE_BASE_URL || 'http://127.0.0.1:9091',
  ),

  targetEnvironment:
    process.env.TIRAMIS_TARGET_ENV === 'live' ? 'live' : 'test',

  timeoutMs: Number(process.env.TIRAMIS_HTTP_TIMEOUT_MS || 60000),

  sourceService:
    process.env.TIRAMIS_SOURCE_SERVICE || 'insurance-portal-service',

  maxRedirects: 0,

  portalOutboxEnabled: process.env.TIRAMIS_PORTAL_OUTBOX_ENABLED !== 'false',
  portalOutboxBatchSize: Number(
    process.env.TIRAMIS_PORTAL_OUTBOX_BATCH_SIZE || 50,
  ),
  portalOutboxMaxAttempts: Number(
    process.env.TIRAMIS_PORTAL_OUTBOX_MAX_ATTEMPTS || 10,
  ),
  reconciliationEnabled:
    process.env.TIRAMIS_RECONCILIATION_ENABLED !== 'false',
  reconciliationCron:
    process.env.TIRAMIS_RECONCILIATION_CRON || '*/5 * * * *',
  reconciliationBatchSize: Number(
    process.env.TIRAMIS_RECONCILIATION_BATCH_SIZE || 50,
  ),
  callbackOverdueMinutes: Number(
    process.env.TIRAMIS_CALLBACK_OVERDUE_MINUTES || 30,
  ),
  portalTransportRetryEnabled:
    process.env.TIRAMIS_PORTAL_TRANSPORT_RETRY_ENABLED === 'true',
  legacyRoutesEnabled: process.env.TIRAMIS_LEGACY_ROUTES_ENABLED !== 'false',
  legacyWebhookEnabled:
    process.env.TIRAMIS_LEGACY_WEBHOOK_ENABLED === 'true',
}));
