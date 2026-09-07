import {
  Logger,
  RequestMethod,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

import { buildUrl, readLoggerEnv } from '@insurance-max/shared-config';
import { bindRequestContext } from '@insurance-max/shared-kernel';

import { AppModule } from './app.module';

async function bootstrap() {
  const loggerEnv = readLoggerEnv();

  const app = await NestFactory.create(AppModule, {
    logger: loggerEnv.enabled ? loggerEnv.levels : false,
    rawBody: true,
  });

  app.enableShutdownHooks();
  bindRequestContext(app);

  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');
  const host = configService.get<string>('app.host') || '0.0.0.0';
  const port = configService.get<number>('app.port') || 9090;
  const globalPrefix = configService.get<string>('app.globalPrefix') || 'api';
  const version = configService.get<string>('app.version') || 'v1';
  const versionLabel = version.replace(/^v/i, '') || '1';
  const appBaseUrl = configService.getOrThrow<string>('app.appUrl');
  const corsEnabled = configService.get<boolean>('cors.enabled') ?? true;
  const swaggerEnabled = configService.get<boolean>('SWAGGER_ENABLED') ?? false;
  const trustProxyEnabled =
    configService.get<boolean>('TRUST_PROXY_ENABLED') ?? true;
  const trustProxyHops = configService.get<number>('TRUST_PROXY_HOPS') ?? 1;
  const rawCorsOrigin =
    configService.get<string | string[]>('cors.origin') ||
    configService.get<string>('app.frontendUrl') ||
    '*';
  const corsMethods =
    configService.get<string>('cors.methods') ||
    'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS';
  const corsCredentials =
    configService.get<boolean>('cors.credentials') ?? true;
  const corsOrigin = (() => {
    const origins = Array.isArray(rawCorsOrigin)
      ? rawCorsOrigin.map((origin) => origin.trim()).filter(Boolean)
      : rawCorsOrigin
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean);

    if (!origins.length) {
      return true;
    }

    if (origins.includes('*')) {
      return true;
    }

    return origins;
  })();

  const isHttps = appBaseUrl.startsWith('https://');

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'validator.swagger.io'],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          // Only force HTTP->HTTPS upgrades when the app is actually served
          // over HTTPS. Otherwise browsers rewrite Swagger asset requests to
          // https:// on plain-HTTP deployments (e.g. bare IP:port), which
          // fails with ERR_SSL_PROTOCOL_ERROR since no TLS is listening there.
          ...(isHttps ? {} : { upgradeInsecureRequests: null }),
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(cookieParser());

  if (trustProxyEnabled) {
    app.getHttpAdapter().getInstance().set('trust proxy', trustProxyHops);
  }

  if (corsEnabled) {
    app.enableCors({
      origin: corsOrigin,
      credentials: corsCredentials,
      methods: corsMethods.split(',').map((method) => method.trim()),
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Api-Key',
        'X-Tenant-Id',
        'X-Request-Id',
        'X-Correlation-Id',
        'X-Idempotency-Key',
        'X-Device-Token',
      ],
      exposedHeaders: [
        'X-Request-Id',
        'X-Correlation-Id',
        'Content-Disposition',
      ],
    });
  }

  app.setGlobalPrefix(globalPrefix, {
    exclude: [{ path: '', method: RequestMethod.GET }],
  });

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: versionLabel,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      stopAtFirstError: false,

      transformOptions: { enableImplicitConversion: true },

      validationError: {
        target: false,
        value: false,
      },
    }),
  );

  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle(configService.getOrThrow<string>('app.name'))
      .setDescription(
        'Insurance portal microservice for identity, access, products, and rating operations.',
      )
      .setVersion(version)
      // Swagger paths already include the global prefix and URI version.
      // Keep the server URL at the origin to avoid generating /api/api/... URLs.
      .addServer(appBaseUrl)
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'access-token',
      )
      .addApiKey({ type: 'apiKey', name: 'X-Api-Key', in: 'header' }, 'api-key')
      .addTag('auth', 'Authentication & authorization flows')
      .addTag('users', 'User management')
      .addTag('roles', 'Role management')
      .addTag('permissions', 'Permission management')
      .addTag('sessions', 'Session & device management')
      .addTag('otp', 'OTP verification')
      .addTag('api-clients', 'API client management')
      .addTag('audit', 'Audit logs')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);

    for (const pathItem of Object.values(document.paths ?? {})) {
      for (const operation of Object.values(pathItem ?? {})) {
        if (!operation || typeof operation !== 'object') {
          continue;
        }

        const operationObject = operation as {
          security?: Array<Record<string, string[]>>;
        };

        if (!operationObject.security?.length) {
          continue;
        }

        operationObject.security = operationObject.security.map(
          (securityRequirement) => {
            if (
              'bearer' in securityRequirement &&
              !('access-token' in securityRequirement)
            ) {
              const { bearer, ...rest } = securityRequirement;
              return { ...rest, 'access-token': bearer };
            }

            return securityRequirement;
          },
        );
      }
    }

    if (
      document.components?.securitySchemes?.['access-token'] &&
      !document.components.securitySchemes.bearer
    ) {
      document.components.securitySchemes.bearer =
        document.components.securitySchemes['access-token'];
    }

    SwaggerModule.setup('api-documentation', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  await app.listen(port, host);

  // Keep the ready signal visible even when LOGGER_LEVEL intentionally excludes
  // Nest's `log` level. Without this, a successful long compile looks hung.
  process.stdout.write(
    `[startup] Insurance portal service running at: ${appBaseUrl}\n`,
  );
  if (swaggerEnabled) {
    logger.log(
      `Swagger docs available at: ${buildUrl(appBaseUrl, 'api-documentation')}`,
    );
  }
}

void bootstrap().catch((error: unknown) => {
  // Nest's logger may be disabled or restricted to selected levels. Bootstrap
  // failures must still be visible and must produce a failing exit code.
  const message = error instanceof Error ? error.stack || error.message : error;
  console.error('[startup] Insurance portal service failed to start:', message);
  process.exitCode = 1;
});
