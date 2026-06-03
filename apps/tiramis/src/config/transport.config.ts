import { registerAs } from '@nestjs/config';

export default registerAs('transport', () => ({
  host: process.env.TCP_HOST || '0.0.0.0',
  port: Number(process.env.TCP_PORT || 4001),
}));
