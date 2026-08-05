import { registerAs } from '@nestjs/config';

import { buildUrl, normalizeBaseUrl } from '@insurance-max/shared-config';

export default registerAs('app', () => {
  const appUrl = normalizeBaseUrl(
    process.env.APP_URL || 'http://localhost:9090',
  );

  const frontendUrl = normalizeBaseUrl(
    process.env.APP_FRONTEND_URL || 'http://localhost:9092',
  );

  const globalPrefix = process.env.APP_GLOBAL_PREFIX?.trim() || 'api';

  return {
    name: process.env.APP_NAME?.trim() || 'Insurance Portal Service',

    env: process.env.APP_ENV || process.env.NODE_ENV || 'development',

    host: process.env.APP_HOST?.trim() || '0.0.0.0',

    port: Number(process.env.APP_PORT || 9090),

    globalPrefix,

    version: process.env.APP_VERSION?.trim() || 'v1',

    timezone: process.env.APP_TIMEZONE?.trim() || 'Africa/Dar_es_Salaam',

    nodeEnv: process.env.APP_ENV || process.env.NODE_ENV || 'development',

    appUrl,
    frontendUrl,

    apiBaseUrl: buildUrl(appUrl, globalPrefix),

    supportEmail: process.env.SUPPORT_EMAIL || 'support@insurance-idp.tz',

    enableEmailVerification: process.env.ENABLE_EMAIL_VERIFICATION !== 'false',

    emailVerificationExpiryHours: Number(
      process.env.EMAIL_VERIFICATION_EXPIRY_HOURS || 24,
    ),

    maxLoginAttempts: Number(process.env.MAX_LOGIN_ATTEMPTS || 5),

    accountLockoutMinutes: Number(process.env.ACCOUNT_LOCKOUT_MINUTES || 15),

    otp: {
      length: Number(process.env.OTP_LENGTH || 6),
      expirySeconds: Number(process.env.OTP_EXPIRY_SECONDS || 300),
      maxAttempts: Number(process.env.OTP_MAX_ATTEMPTS || 3),
      smsProvider: process.env.SMS_PROVIDER || 'beem',
    },

    auth: {
      twoFactorExpiration: process.env.JWT_2FA_EXPIRATION || '5m',

      twoFactorMaxAttempts: Number(process.env.AUTH_2FA_MAX_ATTEMPTS || 5),

      trustedDeviceDays: Number(process.env.AUTH_TRUSTED_DEVICE_DAYS || 30),

      allowTrustedDeviceBypass:
        process.env.AUTH_ALLOW_TRUSTED_DEVICE_BYPASS !== 'false',
    },
  };
});
