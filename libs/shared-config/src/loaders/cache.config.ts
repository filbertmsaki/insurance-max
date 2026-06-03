import { registerAs } from '@nestjs/config';

export default registerAs('cache', () => ({
  enabled: process.env.CACHE_ENABLED === 'true',
  store: process.env.CACHE_STORE || 'memory',
  ttl: Number(process.env.CACHE_TTL || 60),
  max: Number(process.env.CACHE_MAX || 1000),
}));
