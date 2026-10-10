import { registerAs } from '@nestjs/config';

import { normalizeBaseUrl } from '@insurance-max/shared-config';

export default registerAs('tiramisClient', () => ({
  baseUrl: normalizeBaseUrl(
    process.env.TIRAMIS_SERVICE_BASE_URL || 'http://127.0.0.1:9091',
  ),

  tiraEnv: ['local', 'uat', 'production'].includes(
    process.env.TIRA_ENV?.trim() || '',
  )
    ? process.env.TIRA_ENV!.trim()
    : 'local',

  timeoutMs: Number(process.env.TIRAMIS_HTTP_TIMEOUT_MS || 60000),

  sourceService:
    process.env.TIRAMIS_SOURCE_SERVICE || 'insurance-portal-service',

  // IP the TIRAMIS service calls the portal webhook from; the webhook API key
  // is allowlisted to it. Defaults to the host of TIRAMIS_SERVICE_BASE_URL.
  webhookSourceIp: process.env.TIRAMIS_WEBHOOK_SOURCE_IP?.trim() || null,

  maxRedirects: 0,

  callbackOverdueMinutes: Number(
    process.env.TIRAMIS_CALLBACK_OVERDUE_MINUTES || 30,
  ),
}));
