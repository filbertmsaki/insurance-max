import { registerAs } from '@nestjs/config';
import { buildUrl, normalizeBaseUrl } from '@insurance-max/shared-config';

export default registerAs('tiramisService', () => ({
  name: process.env.APP_NAME?.trim() || 'tiramis',
  description: 'First standalone microservice in the platform',
  envFilePath: 'apps/tiramis/.env',
  url: normalizeBaseUrl(process.env.APP_URL as string),
  apiBaseUrl: buildUrl(
    process.env.APP_URL as string,
    process.env.APP_GLOBAL_PREFIX || 'api',
  ),
  testBaseUrl: normalizeBaseUrl(process.env.TIRAMIS_TEST_BASE_URL as string),
  liveBaseUrl: normalizeBaseUrl(process.env.TIRAMIS_LIVE_BASE_URL as string),
  portalHost: process.env.INSURANCE_PORTAL_TCP_HOST as string,
  portalPort: Number(process.env.INSURANCE_PORTAL_TCP_PORT),
  portalNotifyEnabled: process.env.TIRAMIS_PORTAL_NOTIFY_ENABLED !== 'false',
}));
