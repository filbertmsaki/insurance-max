import { registerAs } from '@nestjs/config';
import { buildUrl, normalizeBaseUrl } from '@insurance-max/shared-config';

export default registerAs('app', () => ({
  name: process.env.APP_NAME?.trim() || 'Insurance Portal Service',
  env: process.env.APP_ENV || process.env.NODE_ENV || 'development',
  host: process.env.APP_HOST || '0.0.0.0',
  port: parseInt(process.env.APP_PORT || '3000', 10),
  globalPrefix: process.env.APP_GLOBAL_PREFIX || 'api',
  version: process.env.APP_VERSION || 'v1',
  timezone: process.env.APP_TIMEZONE || 'Africa/Dar_es_Salaam',
  nodeEnv: process.env.APP_ENV || process.env.NODE_ENV || 'development',
  appUrl: normalizeBaseUrl(process.env.APP_URL || 'http://localhost:3000'),
  frontendUrl: normalizeBaseUrl(
    process.env.APP_FRONTEND_URL || 'http://localhost:3001',
  ),
  apiBaseUrl: buildUrl(
    process.env.APP_URL || 'http://localhost:3000',
    process.env.APP_GLOBAL_PREFIX || 'api',
  ),
  appName: process.env.APP_NAME || 'Insurance Portal Service',
  supportEmail: process.env.SUPPORT_EMAIL || 'support@insurance-idp.tz',
  enableEmailVerification: process.env.ENABLE_EMAIL_VERIFICATION !== 'false',
  emailVerificationExpiryHours: parseInt(
    process.env.EMAIL_VERIFICATION_EXPIRY_HOURS || '24',
    10,
  ),
  maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5', 10),
  accountLockoutMinutes: parseInt(
    process.env.ACCOUNT_LOCKOUT_MINUTES || '15',
    10,
  ),
  otp: {
    length: parseInt(process.env.OTP_LENGTH || '6', 10),
    expirySeconds: parseInt(process.env.OTP_EXPIRY_SECONDS || '300', 10),
    maxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS || '3', 10),
    smsProvider: process.env.SMS_PROVIDER || 'beem',
  },
}));
