import { registerAs } from '@nestjs/config';

export default registerAs('cors', () => {
  const origins = process.env.CORS_ORIGIN || '*';
  const frontendUrl = process.env.APP_FRONTEND_URL?.trim();

  const normalizeOrigins = (value: string) =>
    value
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);

  return {
    enabled: process.env.CORS_ENABLED === 'true',
    origin:
      origins === '*'
        ? '*'
        : Array.from(
            new Set([
              ...normalizeOrigins(origins),
              ...(frontendUrl ? [frontendUrl] : []),
            ]),
          ),
    methods: process.env.CORS_METHODS || 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: process.env.CORS_CREDENTIALS === 'true',
  };
});
