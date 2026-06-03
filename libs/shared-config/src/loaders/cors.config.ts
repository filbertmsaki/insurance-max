import { registerAs } from '@nestjs/config';

export default registerAs('cors', () => {
  const origins = process.env.CORS_ORIGIN || '*';

  return {
    enabled: process.env.CORS_ENABLED === 'true',
    origin:
      origins === '*' ? '*' : origins.split(',').map((origin) => origin.trim()),
    methods: process.env.CORS_METHODS || 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: process.env.CORS_CREDENTIALS === 'true',
  };
});
