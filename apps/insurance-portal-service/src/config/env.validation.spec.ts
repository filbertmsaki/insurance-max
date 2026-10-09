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

  describe('template placeholder secrets', () => {
    const production = {
      ...valid,
      APP_ENV: 'production',
      JWT_ACCESS_SECRET: 'c'.repeat(32),
      JWT_REFRESH_SECRET: 'd'.repeat(32),
      JWT_RESET_SECRET: 'e'.repeat(32),
      JWT_2FA_SECRET: 'f'.repeat(32),
    };

    it('accepts real secrets in production', () => {
      const result = insurancePortalEnvValidationSchema.validate(production);
      expect(result.error).toBeUndefined();
    });

    it.each([
      ['JWT_ACCESS_SECRET', 'replace-with-at-least-32-character-secret'],
      ['AUTH_BACKUP_CODE_PEPPER', 'replace-with-at-least-32-random-characters'],
      [
        'TIRAMIS_SERVICE_API_KEY_ENCRYPTION_KEY',
        'replace-with-at-least-32-character-secret',
      ],
      // Base64 of "REPLACE-BEFORE-DEPLOY-32BYTE-KEY", the shipped sample.
      [
        'AUTH_SECRET_ENCRYPTION_KEY',
        'UkVQTEFDRS1CRUZPUkUtREVQTE9ZLTMyQllURS1LRVk=',
      ],
    ])('rejects a placeholder %s in production', (key, value) => {
      const result = insurancePortalEnvValidationSchema.validate({
        ...production,
        [key]: value,
      });
      expect(result.error?.message).toContain(key);
    });

    it('allows placeholders outside production', () => {
      const result = insurancePortalEnvValidationSchema.validate({
        ...valid,
        AUTH_SECRET_ENCRYPTION_KEY:
          'UkVQTEFDRS1CRUZPUkUtREVQTE9ZLTMyQllURS1LRVk=',
      });
      expect(result.error).toBeUndefined();
    });
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
