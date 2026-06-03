import { registerAs } from '@nestjs/config';

export default registerAs('mail', () => ({
  enabled: process.env.MAIL_ENABLED === 'true',
  host: process.env.MAIL_HOST || '',
  port: Number(process.env.MAIL_PORT || 587),
  secure: process.env.MAIL_SECURE === 'true',
  user: process.env.MAIL_USER || '',
  password: process.env.MAIL_PASSWORD || '',
  fromName: process.env.MAIL_FROM_NAME || 'System',
  fromEmail: process.env.MAIL_FROM_EMAIL || 'no-reply@example.com',
}));
