import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  name: process.env.APP_NAME || 'Insurance Max',
  env: process.env.APP_ENV || 'development',
  host: process.env.APP_HOST || '0.0.0.0',
  port: Number(process.env.APP_PORT || 3000),
  globalPrefix: process.env.APP_GLOBAL_PREFIX || '',
  version: process.env.APP_VERSION || 'v1',
  timezone: process.env.APP_TIMEZONE || 'Africa/Dar_es_Salaam',
}));
