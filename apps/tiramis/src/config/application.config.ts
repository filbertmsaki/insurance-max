import { registerAs } from '@nestjs/config';

import { buildUrl, normalizeBaseUrl } from '@insurance-max/shared-config';

export default registerAs('app', () => {
  const appUrl = normalizeBaseUrl(
    process.env.APP_URL || 'http://localhost:9091',
  );

  const globalPrefix = process.env.APP_GLOBAL_PREFIX?.trim() || 'api';

  return {
    name: process.env.APP_NAME?.trim() || 'TIRAMIS Service',

    env: process.env.APP_ENV || process.env.NODE_ENV || 'development',

    host: process.env.APP_HOST?.trim() || '0.0.0.0',

    port: Number(process.env.APP_PORT || 9091),

    globalPrefix,

    version: process.env.APP_VERSION?.trim() || 'v1',

    timezone: process.env.APP_TIMEZONE?.trim() || 'Africa/Dar_es_Salaam',

    url: appUrl,

    apiBaseUrl: buildUrl(appUrl, globalPrefix),
  };
});
