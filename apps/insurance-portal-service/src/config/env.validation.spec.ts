import { insurancePortalEnvValidationSchema } from './env.validation';

describe('insurance portal environment validation', () => {
  const valid = {
    APP_NAME: 'Insurance Portal Service',
    APP_ENV: 'development',
    APP_HOST: '0.0.0.0',
    APP_PORT: 3000,
    APP_GLOBAL_PREFIX: 'api',
    APP_TIMEZONE: 'Africa/Dar_es_Salaam',
    APP_URL: 'https://api.example.com',
    APP_FRONTEND_URL: 'https://portal.example.com',
    SUPPORT_EMAIL: 'support@example.com',
    AUTH_SECRET_ENCRYPTION_KEY: 'kclGTZzK9BZPtHbqcLGShyEfRqOXJ9SNdb1pFAJnaJs=',
    AUTH_BACKUP_CODE_PEPPER: 'a'.repeat(32),
    AUTH_DEVICE_TOKEN_PEPPER: 'b'.repeat(32),
  };

  it('accepts valid application settings', () => {
    const result = insurancePortalEnvValidationSchema.validate(valid);
    expect(result.error).toBeUndefined();
  });

  it.each([
    ['APP_URL', 'not-a-url'],
    ['APP_FRONTEND_URL', 'not-a-url'],
    ['INSURANCE_PORTAL_WEBHOOK_URL', 'not-a-url'],
    ['SUPPORT_EMAIL', 'not-an-email'],
    ['APP_PORT', 70000],
    ['APP_ENV', 'qa'],
  ])('rejects invalid %s', (key, value) => {
    const result = insurancePortalEnvValidationSchema.validate({
      ...valid,
      [key]: value,
    });
    expect(result.error).toBeDefined();
  });

  it('requires non-default JWT secrets in production', () => {
    const result = insurancePortalEnvValidationSchema.validate({
      ...valid,
      APP_ENV: 'production',
    });
    expect(result.error?.details[0]?.path.join('.')).toBe('JWT_ACCESS_SECRET');
  });

  it('accepts analytics-related environment settings', () => {
    const result = insurancePortalEnvValidationSchema.validate({
      ...valid,
      ANALYTICS_ENABLED: false,
      ANALYTICS_PROJECTION_BATCH_SIZE: 50,
      ANALYTICS_PROJECTION_MAX_ATTEMPTS: 5,
      SESSION_IDLE_MINUTES: 45,
      SECURITY_STEP_UP_MAX_AGE_MINUTES: 15,
      RELEASE_EVIDENCE_FILE: '.release/release-gate.json',
      RELEASE_EVIDENCE_MAX_AGE_HOURS: 24,
      RELEASE_BUILD_LINT_PASSED: true,
    });

    expect(result.error).toBeUndefined();
    expect(result.value.ANALYTICS_ENABLED).toBe(false);
    expect(result.value.ANALYTICS_PROJECTION_BATCH_SIZE).toBe(50);
    expect(result.value.ANALYTICS_PROJECTION_MAX_ATTEMPTS).toBe(5);
    expect(result.value.SESSION_IDLE_MINUTES).toBe(45);
    expect(result.value.SECURITY_STEP_UP_MAX_AGE_MINUTES).toBe(15);
    expect(result.value.RELEASE_EVIDENCE_FILE).toBe(
      '.release/release-gate.json',
    );
    expect(result.value.RELEASE_EVIDENCE_MAX_AGE_HOURS).toBe(24);
    expect(result.value.RELEASE_BUILD_LINT_PASSED).toBe(true);
  });

  it.each([
    ['ANALYTICS_PROJECTION_BATCH_SIZE', 0],
    ['ANALYTICS_PROJECTION_MAX_ATTEMPTS', 0],
  ])('rejects invalid analytics value for %s', (key, value) => {
    const result = insurancePortalEnvValidationSchema.validate({
      ...valid,
      [key]: value,
    });
    expect(result.error).toBeDefined();
  });
});
