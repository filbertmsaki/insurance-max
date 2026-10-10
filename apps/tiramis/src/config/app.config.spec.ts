import tiramisServiceConfig from './app.config';
import { tiramisEnvValidationSchema } from './env.validation';

describe('tiramisService config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      APP_ENV: 'development',
      NODE_ENV: 'test',
      APP_URL: 'http://localhost:9091',
      APP_GLOBAL_PREFIX: 'api',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('uses optional env overrides when valid values are provided', () => {
    process.env.TIRAMIS_CALLBACK_DEAD_LETTER_RAW_XML_MODE = 'full';
    process.env.TIRAMIS_CALLBACK_DIAGNOSTICS_RETENTION_ENABLED = 'false';
    process.env.TIRAMIS_CALLBACK_DIAGNOSTICS_RETENTION_DAYS = '30';
    process.env.TIRAMIS_RETRY_ENABLED = 'false';
    process.env.TIRAMIS_PORTAL_NOTIFY_ENABLED = 'false';
    process.env.TIRAMIS_HTTP_TIMEOUT_MS = '120000';
    process.env.TIRAMIS_LOG_PAYLOADS = 'true';
    process.env.TIRAMIS_PORTAL_WEBHOOK_RETRY_DELAYS_SECONDS = '1,2,3';

    const config = tiramisServiceConfig();

    expect(config.callbackDeadLetterRawXmlMode).toBe('full');
    expect(config.callbackDiagnosticsRetentionEnabled).toBe(false);
    expect(config.callbackDiagnosticsRetentionDays).toBe(30);
    expect(config.retryEnabled).toBe(false);
    expect(config.portalNotifyEnabled).toBe(false);
    expect(config.requestTimeoutMs).toBe(120000);
    expect(config.logPayloads).toBe(true);
    expect(config.portalWebhookRetryDelaysSeconds).toEqual([1, 2, 3]);
  });

  it('falls back to defaults for empty and whitespace-only optional values', () => {
    process.env.TIRAMIS_RETRY_ENABLED = '   ';
    process.env.TIRAMIS_RETRY_BATCH_SIZE = '';
    process.env.TIRAMIS_CALLBACK_DEAD_LETTER_RAW_XML_MODE = ' ';

    const config = tiramisServiceConfig();

    expect(config.retryEnabled).toBe(true);
    expect(config.retryBatchSize).toBe(20);
    expect(config.callbackDeadLetterRawXmlMode).toBe('redacted');
  });

  it('rejects invalid non-empty optional values during validation', () => {
    const result = tiramisEnvValidationSchema.validate(
      {
        APP_URL: 'http://localhost:9091',
        TIRAMIS_SECRET_ENCRYPTION_KEY: 'replace-with-key',
        TIRA_ENV: 'uat',
        TIRA_CLIENT_CODE: 'CLIENT-PLATFORM',
        TIRA_CLIENT_KEY: 'client-key',
        TIRA_SYSTEM_CODE: 'SYS-PLATFORM',
        TIRA_CLIENT_CERT_PASSWORD: 'client-password',
        TIRA_PUBLIC_CERT_PASSWORD: 'public-password',
        TIRAMIS_BASE_URL: 'https://test-tira.example.com',
        TIRAMIS_RETRY_ENABLED: 'maybe',
      },
      { abortEarly: false, allowUnknown: true },
    );

    expect(result.error?.message).toContain('TIRAMIS_RETRY_ENABLED');
  });

  it('enforces production webhook transport safeguards automatically', () => {
    process.env.APP_ENV = 'production';
    process.env.NODE_ENV = 'production';

    const config = tiramisServiceConfig();

    expect(config.portalWebhookRequireHttps).toBe(true);
    expect(config.portalWebhookBlockPrivateIps).toBe(true);
  });

  it('keeps local webhook transport permissive for development', () => {
    process.env.APP_ENV = 'development';
    process.env.NODE_ENV = 'development';

    const config = tiramisServiceConfig();

    expect(config.portalWebhookRequireHttps).toBe(false);
    expect(config.portalWebhookBlockPrivateIps).toBe(false);
  });
});
