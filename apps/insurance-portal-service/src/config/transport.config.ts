import { registerAs } from '@nestjs/config';

export default registerAs('transport', () => ({
  host: process.env.PORTAL_TCP_HOST || '0.0.0.0',
  port: Number(process.env.PORTAL_TCP_PORT || 4002),
}));
