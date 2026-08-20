import * as Joi from 'joi';

export const tiramisEnvValidationSchema = Joi.object({
  APP_NAME: Joi.string().trim().min(1).default('Alliance Platform'),
  APP_ENV: Joi.string()
    .valid('local', 'development', 'test', 'uat', 'staging', 'production')
    .default('development'),
  APP_HOST: Joi.string().trim().min(1).default('0.0.0.0'),
  APP_PORT: Joi.number().integer().min(1).max(65535).default(9091),
  APP_GLOBAL_PREFIX: Joi.string()
    .trim()
    .pattern(/^[^/]+(?:\/[^/]+)*$/)
    .default('api'),
  APP_VERSION: Joi.string().default('v1'),
  APP_TIMEZONE: Joi.string()
    .trim()
    .custom((value, helpers) => {
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
        return value;
      } catch {
        return helpers.error('any.invalid');
      }
    })
    .default('Africa/Dar_es_Salaam'),
  APP_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .required(),
  // Selects the TIRA configuration independently from the application environment.
  TIRAMIS_TARGET_ENV: Joi.string().valid('test', 'live').optional(),
  DB_TYPE: Joi.string()
    .valid('postgres', 'mysql', 'oracle')
    .default('postgres'),
  DB_HOST: Joi.string().default('localhost'),
  DB_PORT: Joi.number().default(5432),
  DB_USERNAME: Joi.string().default('postgres'),
  DB_PASSWORD: Joi.when('APP_ENV', {
    is: 'production',
    then: Joi.string().min(1).required(),
    otherwise: Joi.string().allow('').default(''),
  }),
  DB_DATABASE: Joi.string().default('alliance_db'),
  DB_ORACLE_CONNECT_STRING: Joi.string().allow('').default(''),
  DB_SYNCHRONIZE: Joi.boolean().default(false),
  DB_LOGGING: Joi.boolean().default(true),
  DB_SSL: Joi.boolean().default(false),

  LOGGER_ENABLED: Joi.boolean().default(true),
  LOGGER_LEVEL: Joi.string().default('log,error,warn,debug,verbose'),
  LOGGER_PRETTY: Joi.boolean().default(true),

  TIRAMIS_SECRET_ENCRYPTION_KEY: Joi.string().required(),
  TIRAMIS_CERTIFICATE_BASE_DIR: Joi.string().default(
    '/opt/apps/tiramis/certificates',
  ),
  TIRAMIS_CERTIFICATE_EXPIRY_WARNING_DAYS: Joi.number().default(30),
  TIRAMIS_TEST_BASE_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .required(),
  TIRAMIS_LIVE_BASE_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .required(),
  TIRAMIS_TEST_CALLBACK_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .optional(),
  TIRAMIS_LIVE_CALLBACK_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .optional(),

  TIRAMIS_TCP_HOST: Joi.string().default('0.0.0.0'),
  TIRAMIS_TCP_PORT: Joi.number().default(4001),
  TIRAMIS_PORTAL_NOTIFY_ENABLED: Joi.boolean().default(true),
  INSURANCE_PORTAL_EVENT_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .default('http://127.0.0.1:9090/api/v1/internal/tiramis/events'),
  TIRAMIS_PORTAL_EVENT_OUTBOX_ENABLED: Joi.boolean().default(true),
  TIRAMIS_PORTAL_EVENT_BATCH_SIZE: Joi.number().integer().min(1).default(50),
  TIRAMIS_PORTAL_EVENT_MAX_ATTEMPTS: Joi.number().integer().min(1).default(12),
  TIRAMIS_PORTAL_EVENT_BASE_DELAY_SECONDS: Joi.number()
    .integer()
    .min(1)
    .default(30),
  TIRAMIS_PORTAL_EVENT_MAX_DELAY_SECONDS: Joi.number()
    .integer()
    .min(1)
    .default(1800),
  INSURANCE_PORTAL_WEBHOOK_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .default('http://localhost:9090/api/v1/webhooks/tiramis/notifications'),
  INSURANCE_PORTAL_WEBHOOK_TIMEOUT_MS: Joi.number().default(5000),

  TIRAMIS_HTTP_TIMEOUT_MS: Joi.number()
    .integer()
    .min(1000)
    .max(300000)
    .default(60000),
  TIRAMIS_LOG_PAYLOADS: Joi.boolean().default(false),
  TIRAMIS_RETRY_ENABLED: Joi.boolean().default(true),
  TIRAMIS_RETRY_BATCH_SIZE: Joi.number().integer().min(1).default(20),
  TIRAMIS_RETRY_MAX_ATTEMPTS: Joi.number().integer().min(1).default(5),
  TIRAMIS_RETRY_BASE_DELAY_SECONDS: Joi.number().integer().min(1).default(60),
  TIRAMIS_RETRY_MAX_DELAY_SECONDS: Joi.number().integer().min(1).default(900),
  TIRAMIS_FINAL_CALLBACK_TIMEOUT_MINUTES: Joi.number()
    .integer()
    .min(1)
    .default(30),
  TIRAMIS_LEGACY_PORTAL_WEBHOOK_TOKEN_ENABLED: Joi.boolean().default(false),
  // Directory for tiramis_callback_error.log. Must be a path that survives
  // deploys (e.g. /opt/apps/tiramis/shared) — PM2's cwd is a per-release
  // directory that gets replaced on every release. Defaults to cwd for local dev.
  TIRAMIS_CALLBACK_ERROR_LOG_DIR: Joi.string().optional(),
});
