import { registerAs } from '@nestjs/config';

export default registerAs('tiramisClient', () => ({
  baseUrl: (process.env.TIRAMIS_SERVICE_BASE_URL?.trim() || '').replace(
    /\/+$/,
    '',
  ),
  timeoutMs: Number(process.env.TIRAMIS_HTTP_TIMEOUT_MS || 60000),
}));
