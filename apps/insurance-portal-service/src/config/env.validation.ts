import * as Joi from 'joi';

export const insurancePortalEnvValidationSchema = Joi.object({
  APP_NAME: Joi.string().default('Insurance Portal Service'),
  APP_ENV: Joi.string()
    .valid('development', 'production', 'staging', 'test')
    .default('development'),
  APP_HOST: Joi.string().default('0.0.0.0'),
  APP_PORT: Joi.number().default(9090),
  APP_GLOBAL_PREFIX: Joi.string().default('api'),
  APP_VERSION: Joi.string().default('v1'),
  APP_TIMEZONE: Joi.string().default('Africa/Dar_es_Salaam'),
  APP_URL: Joi.string().uri().default('http://localhost:9090'),
  APP_FRONTEND_URL: Joi.string().uri().default('http://localhost:5173'),
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

  CORS_ENABLED: Joi.boolean().default(true),
  CORS_ORIGIN: Joi.string().default(
    'http://localhost:3000,http://localhost:4200,http://localhost:5173',
  ),
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

  JWT_ACCESS_SECRET: Joi.string().default('default-access-secret'),
  JWT_REFRESH_SECRET: Joi.string().default('default-refresh-secret'),
  JWT_RESET_SECRET: Joi.string().default('default-reset-secret'),
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

  THROTTLER_TTL: Joi.number().default(60000),
  THROTTLER_LIMIT: Joi.number().default(100),

  TCP_HOST: Joi.string().default('0.0.0.0'),
  TCP_PORT: Joi.number().default(4002),

  TIRAMIS_SERVICE_HOST: Joi.string().default('127.0.0.1'),
  TIRAMIS_SERVICE_TCP_PORT: Joi.number().default(9095),
  TIRAMIS_TCP_TIMEOUT_MS: Joi.number().default(60000),
  TIRAMIS_STATUS_SYNC_ENABLED: Joi.boolean().default(true),
  TIRAMIS_STATUS_SYNC_LIMIT: Joi.number().default(50),
});
