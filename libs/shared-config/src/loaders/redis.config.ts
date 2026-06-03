import { registerAs } from '@nestjs/config';

export default registerAs('redis', () => ({
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT || 6379),
  password: process.env.REDIS_PASSWORD || undefined,
  db: Number(process.env.REDIS_DB || 0),
  keyPrefix: process.env.REDIS_KEY_PREFIX || '',
  retryAttempts: Number(process.env.REDIS_RETRY_ATTEMPTS || 5),
  retryDelay: Number(process.env.REDIS_RETRY_DELAY || 3000),
}));
