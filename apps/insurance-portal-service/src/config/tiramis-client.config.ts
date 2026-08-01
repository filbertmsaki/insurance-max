import { registerAs } from '@nestjs/config';

export default registerAs('tiramisClient', () => ({
  host: process.env.TIRAMIS_SERVICE_HOST?.trim() || '127.0.0.1',
  port: Number(process.env.TIRAMIS_SERVICE_TCP_PORT || 4001),
  timeoutMs: Number(process.env.TIRAMIS_TCP_TIMEOUT_MS || 60000),
}));
