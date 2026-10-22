// Redeploy trigger: restart the production TIRAMIS process via CI/CD.
import * as bodyParser from 'body-parser';
import { Logger, RequestMethod, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { buildUrl, readLoggerEnv } from '@insurance-max/shared-config';
import { bindRequestContext } from '@insurance-max/shared-kernel';

import { AppModule } from './app.module';

async function bootstrap() {
  const loggerEnv = readLoggerEnv();

  const app = await NestFactory.create(AppModule, {
    logger: loggerEnv.enabled ? loggerEnv.levels : false,
  });
  app.enableShutdownHooks();
  bindRequestContext(app);

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

  const configService = app.get(ConfigService);
  const trustedProxyIps = (process.env.TIRAMIS_TRUSTED_PROXY_IPS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  // Never trust arbitrary X-Forwarded-For values. Only configured proxy
  // addresses may supply the client IP used for API-key allowlist checks.
  app
    .getHttpAdapter()
    .getInstance()
    .set('trust proxy', trustedProxyIps.length ? trustedProxyIps : false);
  const logger = new Logger('Bootstrap');
  const appHost = configService.getOrThrow<string>('app.host');
  const appPort = configService.getOrThrow<number>('app.port');
  const globalPrefix = configService.getOrThrow<string>('app.globalPrefix');
  const appBaseUrl = configService.getOrThrow<string>('tiramisService.url');
  const apiBaseUrl = configService.getOrThrow<string>(
    'tiramisService.apiBaseUrl',
  );
  const docsUrl = buildUrl(appBaseUrl, globalPrefix, 'docs');

  app.use(
    bodyParser.text({
      type: ['application/xml', 'text/xml', '*/xml'],
      limit: '10mb',
    }),
  );

  if (globalPrefix) {
    app.setGlobalPrefix(globalPrefix, {
      exclude: [{ path: '', method: RequestMethod.GET }],
    });
  }

  const swaggerConfig = new DocumentBuilder()
    .setTitle(configService.getOrThrow<string>('app.name'))
    .setDescription(
      [
        'Tiramis service API documentation.',
        '',
        'Protected endpoints require only `X-API-Key`.',
        'Tenant/company data may be sent as request business context, but it is not used to authenticate access to TIRAMIS.',
      ].join('\n'),
    )
    .setVersion(configService.get<string>('app.version') || 'v1')
    .addApiKey(
      {
        type: 'apiKey',
        name: 'X-API-Key',
        in: 'header',
        description:
          'Database-managed TIRAMIS service API key. The raw key is shown only when generated or rotated.',
      },
      'api-key',
    )
    // The generated paths already contain the global prefix. Keep the server
    // URL at the origin so Swagger does not produce /api/api/... URLs.
    .addServer(appBaseUrl)
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);

  for (const pathItem of Object.values(swaggerDocument.paths)) {
    for (const operation of Object.values(pathItem ?? {})) {
      if (
        !operation ||
        typeof operation !== 'object' ||
        !('responses' in operation)
      ) {
        continue;
      }

      operation.security ??= [{ 'api-key': [] }];
    }
  }

  SwaggerModule.setup('docs', app, swaggerDocument, {
    useGlobalPrefix: true,
    swaggerOptions: { persistAuthorization: true },
  });

  await app.listen(appPort, appHost);

  logger.log(`Tiramis service running at: ${appBaseUrl}`);
  logger.log(`Tiramis API base available at: ${apiBaseUrl}`);
  logger.log(`Swagger docs available at: ${docsUrl}`);
}

void bootstrap();
