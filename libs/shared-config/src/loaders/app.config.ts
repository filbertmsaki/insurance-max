import { registerAs } from '@nestjs/config';
import { buildUrl, normalizeBaseUrl } from '../utils/url.util';

export default registerAs('app', () => ({
  name: process.env.APP_NAME?.trim() || 'Insurance Max',
  env: process.env.APP_ENV?.trim() || 'development',
  host: process.env.APP_HOST?.trim() || '0.0.0.0',
  port: Number(process.env.APP_PORT || 3000),
  globalPrefix: process.env.APP_GLOBAL_PREFIX?.trim() || 'api',
  version: process.env.APP_VERSION?.trim() || 'v1',
  timezone: process.env.APP_TIMEZONE?.trim() || 'Africa/Dar_es_Salaam',
  url: normalizeBaseUrl(process.env.APP_URL?.trim() || 'http://localhost:3000'),
  frontendUrl: normalizeBaseUrl(
    process.env.APP_FRONTEND_URL?.trim() || 'http://localhost:3001',
  ),
  apiBaseUrl: buildUrl(
    process.env.APP_URL?.trim() || 'http://localhost:3000',
    process.env.APP_GLOBAL_PREFIX?.trim() || 'api',
  ),
}));
