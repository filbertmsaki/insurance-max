import { registerAs } from '@nestjs/config';

import { normalizeBaseUrl } from '@insurance-max/shared-config';

export default registerAs('tiramisClient', () => ({
  baseUrl: normalizeBaseUrl(
    process.env.TIRAMIS_SERVICE_BASE_URL || 'http://127.0.0.1:9091',
  ),

  timeoutMs: Number(process.env.TIRAMIS_HTTP_TIMEOUT_MS || 60000),

  sourceService:
    process.env.TIRAMIS_SOURCE_SERVICE || 'insurance-portal-service',

  maxRedirects: 0,
}));
