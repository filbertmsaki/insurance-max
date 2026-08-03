import * as Joi from 'joi';

export const insurancePortalEnvValidationSchema = Joi.object({
  APP_NAME: Joi.string().trim().min(1).default('Insurance Portal Service'),
  APP_ENV: Joi.string()
    .valid('local', 'development', 'test', 'uat', 'staging', 'production')
    .default('development'),
  APP_HOST: Joi.string().trim().min(1).default('0.0.0.0'),
  APP_PORT: Joi.number().integer().min(1).max(65535).default(9090),
  APP_GLOBAL_PREFIX: Joi.string()
    .trim()
    .pattern(/^[^/]+(?:\/[^/]+)*$/)
    .default('api'),
  APP_VERSION: Joi.string().trim().default('v1'),
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
    .default('http://localhost:9090'),
  APP_FRONTEND_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .default('http://localhost:3001'),
  SUPPORT_EMAIL: Joi.string().email().default('support@insurance-idp.tz'),

  DB_TYPE: Joi.string()
    .valid('postgres', 'mysql', 'oracle')
    .default('postgres'),
  DB_HOST: Joi.string().default('localhost'),
  DB_PORT: Joi.number().default(5432),
  DB_USERNAME: Joi.string().default('postgres'),
  DB_PASSWORD: Joi.string().allow('').default('root'),
  DB_DATABASE: Joi.string().default('insurance_portal_db'),
  DB_NAME: Joi.string().optional(),
  DB_SCHEMA: Joi.string().allow('').optional(),
  DB_ORACLE_CONNECT_STRING: Joi.string().allow('').default(''),
  DB_SYNCHRONIZE: Joi.boolean().default(false),
  DB_LOGGING: Joi.boolean().default(true),
  DB_SSL: Joi.boolean().default(false),

  CACHE_ENABLED: Joi.boolean().default(true),
  CACHE_STORE: Joi.string().valid('memory', 'redis').default('memory'),
  CACHE_TTL: Joi.number().default(60),
  CACHE_MAX: Joi.number().default(1000),
  DASHBOARD_CACHE_ENABLED: Joi.boolean().default(true),
  DASHBOARD_CACHE_TTL_SECONDS: Joi.number()
    .integer()
    .min(5)
    .max(3600)
    .default(60),
  DASHBOARD_MAX_RANGE_DAYS: Joi.number()
    .integer()
    .min(31)
    .max(1095)
    .default(366),
  SAAS_BILLING_ENABLED: Joi.boolean().default(true),
  SAAS_BILLING_CYCLE_CRON: Joi.string().default('0 30 1 * * *'),
  SAAS_INVOICE_DUE_DAYS: Joi.number().integer().min(1).default(14),
  SAAS_PAST_DUE_GRACE_DAYS: Joi.number().integer().min(0).default(7),
  SAAS_USAGE_AGGREGATION_CRON: Joi.string().default('0 15 1 * * *'),
  REGULATORY_CALENDAR_ENABLED: Joi.boolean().default(true),
  REGULATORY_CALENDAR_GENERATION_CRON: Joi.string().default('0 10 0 * * *'),
  REGULATORY_MONITOR_CRON: Joi.string().default('0 15 0 * * *'),
  REGULATORY_WARNING_DAYS: Joi.number().integer().min(1).default(7),
  REGULATORY_DEFAULT_TIMEZONE: Joi.string().default('Africa/Dar_es_Salaam'),
  PREMIUM_LEVY_DEFAULT_RATE: Joi.number().min(0).max(100).default(1.5),
  PREMIUM_LEVY_AUTO_CALCULATE: Joi.boolean().default(false),
  PREMIUM_LEVY_REQUIRE_ADJUSTMENT_EVIDENCE: Joi.boolean().default(true),
  REPORTS_ENABLED: Joi.boolean().default(true),
  REPORTS_SCHEDULER_CRON: Joi.string().default('0 * * * * *'),
  REPORTS_WORKER_CRON: Joi.string().default('15 * * * * *'),
  REPORTS_MAX_RETRIES: Joi.number().integer().min(0).max(10).default(3),
  REPORTS_ARTIFACT_RETENTION_DAYS: Joi.number().integer().min(1).default(30),
  REPORTS_REQUIRE_MAIL_VERIFICATION: Joi.boolean().default(true),
  REPORTS_MAIL_VERIFICATION_VALID_HOURS: Joi.number()
    .integer()
    .min(1)
    .default(24),
  REPORTS_MAX_ROWS: Joi.number().integer().min(1).default(200000),
  REPORTS_DEFAULT_TIMEZONE: Joi.string().default('Africa/Dar_es_Salaam'),
  REINSURANCE_DEFAULT_CATEGORY: Joi.number().integer().min(1).default(1),
  REINSURANCE_DEFAULT_BROKERAGE_RATE: Joi.number().min(0).default(0),
  REINSURANCE_DEFAULT_COMMISSION_RATE: Joi.number().min(0).default(0),
  REINSURANCE_RECOVERY_MIN_CONFIDENCE_PCT: Joi.number()
    .min(0)
    .max(100)
    .default(0),

  CORS_ENABLED: Joi.boolean().default(true),
  CORS_ALLOWED_ORIGINS: Joi.string().default('http://localhost:3001'),
  CORS_METHODS: Joi.string().default('GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS'),
  CORS_CREDENTIALS: Joi.boolean().default(true),

  LOGGER_ENABLED: Joi.boolean().default(true),
  LOGGER_LEVEL: Joi.string().default('log,error,warn,debug,verbose'),
  LOGGER_PRETTY: Joi.boolean().default(true),

  MAIL_ENABLED: Joi.boolean().default(true),
  MAIL_HOST: Joi.string().default('smtp.gmail.com'),
  MAIL_PORT: Joi.number().default(587),
  MAIL_SECURE: Joi.boolean().default(false),
  MAIL_USER: Joi.string().default('no-reply@example.com'),
  MAIL_PASSWORD: Joi.string().allow('').default('password'),
  MAIL_FROM_NAME: Joi.string().default('Insurance Portal'),
  MAIL_FROM_EMAIL: Joi.string().email().default('no-reply@example.com'),

  QUEUE_ENABLED: Joi.boolean().default(true),
  QUEUE_PREFIX: Joi.string().default('insurance-portal-service'),
  QUEUE_DEFAULT_JOB_ATTEMPTS: Joi.number().default(3),
  QUEUE_DEFAULT_JOB_DELAY: Joi.number().default(0),
  QUEUE_REMOVE_ON_COMPLETE: Joi.boolean().default(true),
  QUEUE_REMOVE_ON_FAIL: Joi.boolean().default(false),

  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').default(''),
  REDIS_DB: Joi.number().default(0),
  REDIS_KEY_PREFIX: Joi.string().default('insurance-portal:'),
  REDIS_RETRY_ATTEMPTS: Joi.number().default(5),
  REDIS_RETRY_DELAY: Joi.number().default(3000),
  REDIS_OTP_TTL: Joi.number().default(300),
  REDIS_SESSION_TTL: Joi.number().default(86400),

  JWT_ACCESS_SECRET: Joi.when('APP_ENV', {
    is: 'production',
    then: Joi.string().min(32).required(),
    otherwise: Joi.string()
      .min(32)
      .default('local-only-change-me-access-secret-32'),
  }),
  JWT_REFRESH_SECRET: Joi.when('APP_ENV', {
    is: 'production',
    then: Joi.string().min(32).required(),
    otherwise: Joi.string()
      .min(32)
      .default('local-only-change-me-refresh-secret-32'),
  }),
  JWT_RESET_SECRET: Joi.when('APP_ENV', {
    is: 'production',
    then: Joi.string().min(32).required(),
    otherwise: Joi.string()
      .min(32)
      .default('local-only-change-me-reset-secret-32'),
  }),
  JWT_ACCESS_EXPIRATION: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRATION: Joi.string().default('7d'),
  JWT_ISSUER: Joi.string().default('insurance-idp.tz'),
  JWT_AUDIENCE: Joi.string().default('insurance-platform'),

  ENABLE_EMAIL_VERIFICATION: Joi.boolean().default(true),
  EMAIL_VERIFICATION_EXPIRY_HOURS: Joi.number().default(24),
  MAX_LOGIN_ATTEMPTS: Joi.number().default(5),
  ACCOUNT_LOCKOUT_MINUTES: Joi.number().default(15),
  OTP_LENGTH: Joi.number().default(6),
  OTP_EXPIRY_SECONDS: Joi.number().default(300),
  OTP_MAX_ATTEMPTS: Joi.number().default(3),
  SMS_PROVIDER: Joi.string().default('beem'),
  NEXTSMS_USERNAME: Joi.string().allow('').default(''),
  NEXTSMS_PASSWORD: Joi.string().allow('').default(''),
  NEXTSMS_SENDER_ID: Joi.string().default('INFO'),
  NEXTSMS_ENDPOINT: Joi.string()
    .uri()
    .default('https://messaging.nextsms.co.tz/api/sms/v1/text/single'),
  BEEM_ENDPOINT: Joi.string()
    .uri()
    .default('https://apisms.beem.africa/v1/send'),
  AT_LIVE_ENDPOINT: Joi.string()
    .uri()
    .default('https://api.africastalking.com'),
  AT_SANDBOX_ENDPOINT: Joi.string()
    .uri()
    .default('https://api.sandbox.africastalking.com'),

  THROTTLER_TTL: Joi.number().default(60000),
  THROTTLER_LIMIT: Joi.number().default(100),

  TIRAMIS_SERVICE_BASE_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .default('http://127.0.0.1:9091'),
  TIRAMIS_HTTP_TIMEOUT_MS: Joi.number().default(60000),
  TIRAMIS_PORTAL_WEBHOOK_TOKEN: Joi.when('APP_ENV', {
    is: 'production',
    then: Joi.string().min(16).required(),
    otherwise: Joi.string().min(16).default('local-only-tiramis-webhook-token'),
  }),
  TIRAMIS_STATUS_SYNC_ENABLED: Joi.boolean().default(true),
  TIRAMIS_STATUS_SYNC_CRON: Joi.string().default('*/2 * * * *'),
  TIRAMIS_STATUS_SYNC_LIMIT: Joi.number().default(50),
  TIRAMIS_STATUS_SYNC_INCLUDE_PAYLOAD: Joi.boolean().default(true),
  TIRAMIS_CALLBACK_OVERDUE_MINUTES: Joi.number().default(10),
  TIRAMIS_RETRY_ENABLED: Joi.boolean().default(true),
  TIRAMIS_RETRY_CRON: Joi.string().default('*/3 * * * *'),
  TIRAMIS_RETRY_LIMIT: Joi.number().default(25),
  TIRAMIS_RETRY_MAX_ATTEMPTS: Joi.number().default(3),
  TIRAMIS_RETRY_BASE_DELAY_SECONDS: Joi.number().default(60),
  TIRAMIS_RETRY_LOCK_MINUTES: Joi.number().default(5),
  TIRAMIS_RETRY_MAX_DELAY_MINUTES: Joi.number().default(30),
  TIRAMIS_RETRY_LOCK_TIMEOUT_MINUTES: Joi.number().default(15),
  TIRAMIS_AUDIT_ENABLED: Joi.boolean().default(true),
  TIRAMIS_AUDIT_STORE_PAYLOAD_SNAPSHOT: Joi.boolean().default(false),
  TIRAMIS_AUDIT_MAX_METADATA_SIZE: Joi.number().default(20000),
  TIRAMIS_NOTIFICATION_ENABLED: Joi.boolean().default(true),
  TIRAMIS_NOTIFICATION_WEBHOOK_ENABLED: Joi.boolean().default(false),
  TIRAMIS_NOTIFICATION_WEBHOOK_URL: Joi.string().allow('').default(''),
  TIRAMIS_NOTIFICATION_WEBHOOK_TOKEN: Joi.string().allow('').default(''),
  TIRAMIS_NOTIFICATION_DEDUPE_MINUTES: Joi.number().default(30),
  TIRAMIS_NOTIFICATION_MAX_METADATA_SIZE: Joi.number().default(20000),
  TIRAMIS_NOTIFICATION_NOTIFY_FINAL_SUCCESS: Joi.boolean().default(false),
  TIRAMIS_NOTIFICATION_NOTIFY_BUSINESS_SYNC_SUCCESS:
    Joi.boolean().default(false),
});
