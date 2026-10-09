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
  APP_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .required(),
  TIRAMIS_TRUSTED_PROXY_IPS: Joi.string().allow('').default(''),
  PORTAL_ADMIN_JWT_ACCESS_SECRET: Joi.when('APP_ENV', {
    is: 'production',
    then: Joi.string().min(32).required(),
    otherwise: Joi.string().allow('').default(''),
  }),
  PORTAL_ADMIN_JWT_ISSUER: Joi.string().default('insurance-idp.tz'),
  PORTAL_ADMIN_JWT_AUDIENCE: Joi.string().default('insurance-platform'),
  PORTAL_ADMIN_SESSION_VALIDATION_ENABLED: Joi.boolean().default(false),
  PORTAL_ADMIN_SESSION_INTROSPECTION_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .allow('')
    .default(''),
  PORTAL_ADMIN_REQUIRED_PERMISSIONS: Joi.string().allow('').default(''),
  PORTAL_ADMIN_MFA_MAX_AGE_MINUTES: Joi.number().integer().min(0).default(0),
  PORTAL_ADMIN_RATE_LIMIT_MAX: Joi.number().integer().min(0).default(60),
  PORTAL_ADMIN_RATE_LIMIT_WINDOW_MS: Joi.number()
    .integer()
    .min(1000)
    .default(60000),
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
  TIRAMIS_SECRET_ENCRYPTION_KEY: Joi.string().required(),
  TIRAMIS_SECRET_ENCRYPTION_KEY_PREVIOUS: Joi.string().allow('').optional(),
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

  TIRAMIS_PORTAL_NOTIFY_ENABLED: Joi.boolean().default(true),
  INSURANCE_PORTAL_WEBHOOK_TIMEOUT_MS: Joi.number().default(5000),
  TIRAMIS_PORTAL_WEBHOOK_MAX_ATTEMPTS: Joi.number().integer().min(1).default(8),
  TIRAMIS_PORTAL_WEBHOOK_ALLOWED_HOSTS: Joi.string().allow('').default(''),
  TIRAMIS_PORTAL_WEBHOOK_REQUIRE_HTTPS: Joi.boolean().default(false),
  TIRAMIS_PORTAL_WEBHOOK_BLOCK_PRIVATE_IPS: Joi.boolean().default(false),
  TIRAMIS_PORTAL_WEBHOOK_SIGNING_SECRET: Joi.when('APP_ENV', {
    is: 'production',
    then: Joi.string().min(32).allow('').default(''),
    otherwise: Joi.string().allow('').default(''),
  }),
  TIRAMIS_PORTAL_OUTBOX_BATCH_SIZE: Joi.number().integer().min(1).default(20),
  TIRAMIS_PORTAL_OUTBOX_INTERVAL_MS: Joi.number()
    .integer()
    .min(1000)
    .default(10000),

  TIRAMIS_HTTP_TIMEOUT_MS: Joi.number()
    .integer()
    .min(1000)
    .max(300000)
    .default(60000),
  TIRAMIS_LOG_PAYLOADS: Joi.boolean().default(false),
  TIRAMIS_REQUEST_LOG_ENABLED: Joi.boolean().default(true),
  TIRAMIS_REQUEST_LOG_REDACT_XML: Joi.boolean().default(true),
  TIRAMIS_REQUEST_LOG_REDACTED_XML_TAGS: Joi.string().allow('').default(''),
  TIRAMIS_REQUEST_LOG_DIR: Joi.string().trim().min(1).optional(),
  TIRAMIS_CALLBACK_DEAD_LETTER_RAW_XML_MODE: Joi.string()
    .valid('full', 'redacted', 'off')
    .default('redacted'),
  TIRAMIS_CALLBACK_DIAGNOSTICS_RETENTION_ENABLED: Joi.boolean().default(true),
  TIRAMIS_CALLBACK_DIAGNOSTICS_RETENTION_DAYS: Joi.number()
    .integer()
    .min(1)
    .default(180),
  TIRAMIS_LEGACY_RAW_API_KEYS_ENABLED: Joi.boolean().default(true),
  TIRAMIS_RETRY_ENABLED: Joi.boolean().default(true),
  TIRAMIS_RETRY_BATCH_SIZE: Joi.number().integer().min(1).default(20),
  TIRAMIS_RETRY_MAX_ATTEMPTS: Joi.number().integer().min(1).default(5),
  TIRAMIS_RETRY_BASE_DELAY_SECONDS: Joi.number().integer().min(1).default(60),
  TIRAMIS_RETRY_MAX_DELAY_SECONDS: Joi.number().integer().min(1).default(900),
  TIRAMIS_FINAL_CALLBACK_TIMEOUT_MINUTES: Joi.number()
    .integer()
    .min(1)
    .default(30),
  // Protects the signature-bypassed internal callback test route. It must be
  // explicitly enabled for each deployment and defaults to disabled.
  TIRAMIS_INTERNAL_CALLBACK_TESTS_ENABLED: Joi.boolean().default(false),
  // Directory for tiramis_callback_error.log. Must be a path that survives
  // deploys (e.g. /opt/apps/tiramis/shared) — PM2's cwd is a per-release
  // directory that gets replaced on every release. Defaults to cwd for local dev.
  TIRAMIS_CALLBACK_ERROR_LOG_DIR: Joi.string().optional(),
});
