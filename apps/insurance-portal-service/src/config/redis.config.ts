import { registerAs } from '@nestjs/config';

export default registerAs('redis', () => ({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || '0', 10),
  allowInMemoryFallback: process.env.REDIS_ALLOW_IN_MEMORY_FALLBACK === 'true',
  otpTtl: parseInt(process.env.REDIS_OTP_TTL || '300', 10),
  sessionTtl: parseInt(process.env.REDIS_SESSION_TTL || '86400', 10),
}));
