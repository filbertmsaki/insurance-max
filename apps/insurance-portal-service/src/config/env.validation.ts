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
    .default('http://localhost:9092'),
  SUPPORT_EMAIL: Joi.string().email().default('support@insurance-idp.tz'),
  API_DEBUG_ERRORS_ENABLED: Joi.boolean().default(false),

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
  DASHBOARD_MAX_DATE_RANGE_DAYS: Joi.number()
    .integer()
    .min(31)
    .max(1095)
    .default(1095),
  SAAS_BILLING_ENABLED: Joi.boolean().default(true),
  SAAS_BILLING_CYCLE_CRON: Joi.string().default('0 30 1 * * *'),
  SAAS_INVOICE_DUE_DAYS: Joi.number().integer().min(1).default(14),
  SAAS_PAST_DUE_GRACE_DAYS: Joi.number().integer().min(0).default(7),
  SAAS_USAGE_AGGREGATION_CRON: Joi.string().default('0 15 1 * * *'),
  SAAS_DUNNING_CRON: Joi.string().default('0 15 1 * * *'),
  SAAS_AUTO_SUSPEND_ENABLED: Joi.boolean().default(true),
  SAAS_AUTO_RESTORE_AFTER_PAYMENT: Joi.boolean().default(true),
  API_KEYS_ENABLED: Joi.boolean().default(true),
  API_KEY_REQUIRE_IP_ALLOWLIST: Joi.boolean().default(true),
  API_KEY_MAX_IPS_PER_KEY: Joi.number().integer().min(1).default(1),
  API_KEY_DEFAULT_RATE_LIMIT_PER_MINUTE: Joi.number()
    .integer()
    .min(1)
    .default(60),
  API_KEY_ROTATION_GRACE_HOURS: Joi.number().integer().min(1).default(24),
  API_KEY_MAX_VALIDITY_DAYS: Joi.number().integer().min(1).default(365),
  SECURITY_ENCRYPTION_KEY: Joi.string().allow('').default(''),
  SECURITY_ENCRYPTION_KEY_VERSION: Joi.number().integer().min(1).default(1),
  SECURITY_STEP_UP_ENABLED: Joi.boolean().default(true),
  SECURITY_STEP_UP_MAX_AGE_MINUTES: Joi.number().integer().min(1).default(10),
  SECURITY_AUDIT_HASH_CHAIN_ENABLED: Joi.boolean().default(true),
  SECURITY_REQUIRE_2FA_FOR_ALL_USERS: Joi.boolean().default(false),
  SECURITY_REQUIRE_2FA_ROLES: Joi.string()
    .trim()
    .default('ADMINISTRATOR,SUPER_ADMIN'),
  SECURITY_REQUIRE_2FA_PERMISSIONS: Joi.string()
    .trim()
    .default('security-policies:activate,security-policies:approve'),
  SECURITY_REQUIRE_2FA_USER_TYPES: Joi.string()
    .trim()
    .default('SUPER_ADMIN,COMPANY_ADMIN'),
  SESSION_IDLE_MINUTES: Joi.number().integer().min(1).default(1440),
  SESSION_ABSOLUTE_HOURS: Joi.number().integer().min(1).default(24),
  SESSION_MAX_CONCURRENT: Joi.number().integer().min(1).default(5),
  SESSION_REFRESH_ROTATION_ENABLED: Joi.boolean().default(true),
  SESSION_REFRESH_REUSE_DETECTION: Joi.boolean().default(true),
  SESSION_REFRESH_ROTATION_GRACE_SECONDS: Joi.number()
    .integer()
    .min(0)
    .default(30),
  AUDIT_ENABLED: Joi.boolean().default(true),
  AUDIT_HASH_CHAIN_ENABLED: Joi.boolean().default(true),
  AUDIT_SENSITIVE_METADATA_REDACTION: Joi.boolean().default(true),
  DATA_RETENTION_ENABLED: Joi.boolean().default(true),
  DATA_RETENTION_CRON: Joi.string().default('0 0 2 * * *'),
  DATA_RETENTION_DRY_RUN_DEFAULT: Joi.boolean().default(true),
  OBSERVABILITY_ENABLED: Joi.boolean().default(true),
  METRICS_ENABLED: Joi.boolean().default(true),
  TRACING_ENABLED: Joi.boolean().default(true),
  HEALTH_DETAILS_PUBLIC: Joi.boolean().default(false),
  SLOW_REQUEST_THRESHOLD_MS: Joi.number().integer().min(1).default(2000),
  TRUST_PROXY_ENABLED: Joi.boolean().default(true),
  TRUST_PROXY_HOPS: Joi.number().integer().min(0).default(1),
  SWAGGER_ENABLED: Joi.boolean().default(false),
  APP_RELEASE_SHA: Joi.string().allow('').default(''),
  APP_RELEASE_VERSION: Joi.string().allow('').default(''),
  APP_BUILT_AT: Joi.string().allow('').default(''),
  RELEASE_EVIDENCE_FILE: Joi.string()
    .trim()
    .default('.release/release-gate.json'),
  RELEASE_EVIDENCE_MAX_AGE_HOURS: Joi.number().integer().min(1).default(168),
  RELEASE_BUILD_LINT_PASSED: Joi.boolean().default(false),
  RELEASE_BUILD_UNIT_TESTS_PASSED: Joi.boolean().default(false),
  RELEASE_BUILD_INTEGRATION_TESTS_PASSED: Joi.boolean().default(false),
  RELEASE_BUILD_E2E_TESTS_PASSED: Joi.boolean().default(false),
  RELEASE_SECURITY_CRITICAL_FINDINGS: Joi.number().integer().min(0).default(0),
  RELEASE_SECURITY_TENANT_ISOLATION_PASSED: Joi.boolean().default(false),
  RELEASE_SECURITY_SECRETS_SCAN_PASSED: Joi.boolean().default(false),
  RELEASE_SECURITY_AUTHORIZATION_PASSED: Joi.boolean().default(false),
  RELEASE_OPERATIONS_BACKUP_VERIFIED: Joi.boolean().default(false),
  RELEASE_OPERATIONS_RESTORE_VERIFIED: Joi.boolean().default(false),
  RELEASE_OPERATIONS_ROLLBACK_VERIFIED: Joi.boolean().default(false),
  RELEASE_APPROVALS_UAT_APPROVED: Joi.boolean().default(false),
  RELEASE_APPROVALS_TECHNICAL_APPROVED: Joi.boolean().default(false),
  RELEASE_APPROVALS_BUSINESS_APPROVED: Joi.boolean().default(false),
  REGULATORY_ENABLED: Joi.boolean().default(true),
  REGULATORY_CALENDAR_ENABLED: Joi.boolean().default(true),
  REGULATORY_CALENDAR_GENERATION_CRON: Joi.string().default('0 10 0 * * *'),
  REGULATORY_MONITOR_CRON: Joi.string().default('0 15 0 * * *'),
  REGULATORY_DUE_MONITOR_CRON: Joi.string().default('0 * * * *'),
  REGULATORY_MONITOR_BATCH_SIZE: Joi.number().integer().min(1).default(500),
  REGULATORY_WARNING_DAYS: Joi.number().integer().min(1).default(7),
  REGULATORY_DEFAULT_TIMEZONE: Joi.string().default('Africa/Dar_es_Salaam'),
  REGULATORY_RECONCILIATION_TOLERANCE: Joi.number().min(0).default(0.01),
  REGULATORY_REQUIRE_SUBMISSION_EVIDENCE: Joi.boolean().default(true),
  PREMIUM_LEVY_DEFAULT_RATE: Joi.number().min(0).max(100).default(1.5),
  PREMIUM_LEVY_AUTO_CALCULATE: Joi.boolean().default(false),
  PREMIUM_LEVY_REQUIRE_ADJUSTMENT_EVIDENCE: Joi.boolean().default(true),
  REPORTING_ENABLED: Joi.boolean().default(true),
  REPORTING_QUEUE_ENABLED: Joi.boolean().default(true),
  REPORTING_PAGE_SIZE: Joi.number().integer().min(1).default(5000),
  REPORTING_DEFAULT_MAX_ROWS: Joi.number().integer().min(1).default(100000),
  REPORTING_HARD_MAX_ROWS: Joi.number().integer().min(1).default(1000000),
  REPORTING_DEFAULT_RETENTION_DAYS: Joi.number().integer().min(1).default(90),
  REPORTING_MAX_RETENTION_DAYS: Joi.number().integer().min(1).default(3650),
  REPORTING_DOWNLOAD_TOKEN_MINUTES: Joi.number().integer().min(1).default(10),
  REPORTING_SCHEDULE_MONITOR_CRON: Joi.string().default('* * * * *'),
  REPORTING_DELIVERY_MAX_ATTEMPTS: Joi.number().integer().min(1).default(5),
  REPORTING_DELIVERY_BASE_DELAY_SECONDS: Joi.number()
    .integer()
    .min(1)
    .default(60),
  REPORTS_ENABLED: Joi.boolean().default(true),
  REPORTS_SCHEDULER_CRON: Joi.string().default('0 * * * * *'),
  REPORTS_WORKER_CRON: Joi.string().default('15 * * * * *'),

  PORTAL_INVITATION_EXPIRY_HOURS: Joi.number()
    .integer()
    .min(1)
    .max(168)
    .default(48),
  DOCUMENT_STORAGE_ROOT: Joi.string().trim().default('./uploads/documents'),
  DOCUMENT_DEFAULT_MAX_BYTES: Joi.number()
    .integer()
    .min(1024)
    .max(100 * 1024 * 1024)
    .default(10 * 1024 * 1024),
  DOCUMENT_ALLOWED_MIME_TYPES: Joi.string()
    .trim()
    .default('application/pdf,image/jpeg,image/png'),
  NOTIFICATION_QUEUE_ENABLED: Joi.boolean().default(true),
  PORTAL_SESSION_IDLE_MINUTES: Joi.number().integer().min(1).default(1440),
  PORTAL_UPLOAD_ROOT: Joi.string().trim().default('./uploads'),
  PORTAL_UPLOAD_MAX_BYTES: Joi.number()
    .integer()
    .min(1024)
    .max(100 * 1024 * 1024)
    .default(10 * 1024 * 1024),
  PORTAL_ALLOWED_MIME_TYPES: Joi.string()
    .trim()
    .default('application/pdf,image/jpeg,image/png'),
  REPORTS_MAX_RETRIES: Joi.number().integer().min(0).max(10).default(3),
  REPORTS_ARTIFACT_RETENTION_DAYS: Joi.number().integer().min(1).default(30),
  REPORTS_REQUIRE_MAIL_VERIFICATION: Joi.boolean().default(true),
  REPORTS_MAIL_VERIFICATION_VALID_HOURS: Joi.number()
    .integer()
    .min(1)
    .default(24),
  REPORTS_MAX_ROWS: Joi.number().integer().min(1).default(200000),
  REPORTS_DEFAULT_TIMEZONE: Joi.string().default('Africa/Dar_es_Salaam'),
  FINANCE_BASE_CURRENCY: Joi.string()
    .trim()
    .uppercase()
    .length(3)
    .default('TZS'),
  FINANCE_DEFAULT_INVOICE_DUE_DAYS: Joi.number().integer().min(0).default(0),
  FINANCE_ALLOW_OVERPAYMENT: Joi.boolean().default(false),
  FINANCE_AUTO_RECEIPT_PROVIDER_PAYMENTS: Joi.boolean().default(true),
  FINANCE_AUTO_ALLOCATE_EXACT_INVOICE_REFERENCE: Joi.boolean().default(true),
  FINANCE_RECONCILIATION_AUTO_MATCH_SCORE: Joi.number()
    .integer()
    .min(0)
    .max(100)
    .default(90),
  FINANCE_REFUND_APPROVAL_THRESHOLD: Joi.number().min(0).default(0),
  FINANCE_RECEIPT_REVERSAL_APPROVAL_THRESHOLD: Joi.number().min(0).default(0),
  FINANCE_COMMISSION_PAYMENT_APPROVAL_THRESHOLD: Joi.number().min(0).default(0),
  FINANCE_OUTBOX_ENABLED: Joi.boolean().default(true),
  FINANCE_OUTBOX_CRON: Joi.string().default('*/1 * * * *'),
  FINANCE_OUTBOX_BATCH_SIZE: Joi.number().integer().min(1).default(100),
  FINANCE_OUTBOX_MAX_ATTEMPTS: Joi.number().integer().min(1).default(10),
  FINANCE_PROVIDER_PAYLOAD_RETENTION_DAYS: Joi.number()
    .integer()
    .min(1)
    .default(90),

  CORS_ENABLED: Joi.boolean().default(true),
  CORS_ALLOWED_ORIGINS: Joi.string().default('http://localhost:9092'),
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

  ANALYTICS_ENABLED: Joi.boolean().default(true),
  ANALYTICS_PROJECTION_BATCH_SIZE: Joi.number().integer().min(1).default(100),
  ANALYTICS_PROJECTION_MAX_ATTEMPTS: Joi.number().integer().min(1).default(8),
  ANALYTICS_EVENT_CONSUMER_ENABLED: Joi.boolean().default(true),
  ANALYTICS_CURRENT_LAG_SECONDS: Joi.number().integer().min(0).default(300),
  ANALYTICS_STALE_LAG_SECONDS: Joi.number().integer().min(0).default(3600),
  ANALYTICS_REBUILD_ENABLED: Joi.boolean().default(true),
  ANALYTICS_FORECAST_ENABLED: Joi.boolean().default(true),
  ANALYTICS_ANOMALY_ENABLED: Joi.boolean().default(true),
  ANALYTICS_ANOMALY_CRON: Joi.string().default('0 */1 * * *'),
  ANALYTICS_BENCHMARK_MIN_COMPANIES: Joi.number().integer().min(2).default(5),

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
  JWT_ACCESS_EXPIRATION: Joi.string().default('1d'),
  JWT_REFRESH_EXPIRATION: Joi.string().default('7d'),
  JWT_ISSUER: Joi.string().default('insurance-idp.tz'),
  JWT_AUDIENCE: Joi.string().default('insurance-platform'),

  JWT_2FA_SECRET: Joi.when('APP_ENV', {
    is: 'production',
    then: Joi.string().min(32).required(),
    otherwise: Joi.string()
      .min(32)
      .default('development-only-2fa-secret-change-me'),
  }),
  JWT_2FA_EXPIRATION: Joi.string().default('5m'),

  AUTH_2FA_MAX_ATTEMPTS: Joi.number().integer().min(1).max(10).default(5),
  AUTH_TRUSTED_DEVICE_DAYS: Joi.number().integer().min(1).max(365).default(30),
  AUTH_ALLOW_TRUSTED_DEVICE_BYPASS: Joi.boolean().default(true),

  AUTH_SECRET_ENCRYPTION_KEY: Joi.string().base64().required(),
  AUTH_BACKUP_CODE_PEPPER: Joi.string().min(32).required(),
  AUTH_DEVICE_TOKEN_PEPPER: Joi.string().min(32).required(),

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
  // Dedicated encryption key for TIRAMIS service API keys stored in
  // tiramis_company_configurations. Optional: when unset, falls back to
  // deriving from JWT_ACCESS_SECRET for backward compatibility with
  // already-encrypted values, but a dedicated secret should be set so this
  // purpose doesn't share a key with token signing.
  TIRAMIS_SERVICE_API_KEY_ENCRYPTION_KEY: Joi.string().optional(),
  TIRAMIS_TARGET_ENV: Joi.string().valid('test', 'live').default('test'),
  TIRAMIS_SOURCE_SERVICE: Joi.string()
    .trim()
    .min(1)
    .default('insurance-portal-service'),
  TIRAMIS_HTTP_TIMEOUT_MS: Joi.number()
    .integer()
    .min(1000)
    .max(300000)
    .default(60000),
  TIRAMIS_STATUS_SYNC_ENABLED: Joi.boolean().default(true),
  TIRAMIS_STATUS_SYNC_CRON: Joi.string().default('*/2 * * * *'),
  TIRAMIS_STATUS_SYNC_LIMIT: Joi.number().default(50),
  TIRAMIS_STATUS_SYNC_INCLUDE_PAYLOAD: Joi.boolean().default(true),
  TIRAMIS_STATUS_SYNC_MAX_AGE_HOURS: Joi.number().default(72),
  TIRAMIS_PORTAL_OUTBOX_ENABLED: Joi.boolean().default(true),
  TIRAMIS_PORTAL_OUTBOX_BATCH_SIZE: Joi.number().integer().min(1).default(50),
  TIRAMIS_PORTAL_OUTBOX_MAX_ATTEMPTS: Joi.number().integer().min(1).default(10),
  TIRAMIS_RECONCILIATION_ENABLED: Joi.boolean().default(true),
  TIRAMIS_RECONCILIATION_CRON: Joi.string().default('*/5 * * * *'),
  TIRAMIS_RECONCILIATION_BATCH_SIZE: Joi.number().integer().min(1).default(50),
  TIRAMIS_CALLBACK_OVERDUE_MINUTES: Joi.number().default(10),
  TIRAMIS_PORTAL_TRANSPORT_RETRY_ENABLED: Joi.boolean().default(false),
  TIRAMIS_LEGACY_ROUTES_ENABLED: Joi.boolean().default(true),
  TIRAMIS_LEGACY_WEBHOOK_ENABLED: Joi.boolean().default(false),
  INSURANCE_PORTAL_WEBHOOK_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .default('http://localhost:9090/api/v1/webhooks/tiramis/notifications'),
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
  RENEWAL_WINDOW_BEFORE_DAYS: Joi.number().integer().min(0).default(7),
  RENEWAL_WINDOW_AFTER_DAYS: Joi.number().integer().min(0).default(7),
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
