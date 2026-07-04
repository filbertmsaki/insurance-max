import { registerAs } from '@nestjs/config';

export default registerAs('transport', () => ({
  host: process.env.TIRAMIS_TCP_HOST || process.env.TCP_HOST || '0.0.0.0',
  port: Number(process.env.TIRAMIS_TCP_PORT || process.env.TCP_PORT || 4001),
}));
