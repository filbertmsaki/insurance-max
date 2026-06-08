import {
  Logger,
  RequestMethod,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

import { HttpExceptionFilter } from '@insurance-max/portal-shared';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');
  const host = configService.get<string>('app.host') || '0.0.0.0';
  const port = configService.get<number>('app.port') || 9090;
  const globalPrefix = configService.get<string>('app.globalPrefix') || 'api';
  const version = configService.get<string>('app.version') || 'v1';
  const versionLabel = version.replace(/^v/i, '') || '1';
  const browserHost = host === '0.0.0.0' || host === '::' ? 'localhost' : host;
  const appBaseUrl =
    configService.get<string>('app.appUrl') || `http://${browserHost}:${port}`;
  const corsEnabled = configService.get<boolean>('cors.enabled') ?? true;
  const corsOrigin = configService.get('cors.origin', '*');
  const corsMethods =
    configService.get<string>('cors.methods') ||
    'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS';
  const corsCredentials =
    configService.get<boolean>('cors.credentials') ?? true;

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'validator.swagger.io'],
          scriptSrc: ["'self'", "'unsafe-inline'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(cookieParser());

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
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Insurance Portal Service API')
    .setDescription(
      'Insurance portal microservice for identity, access, products, and rating operations.',
    )
    .setVersion(version)
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

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.TCP,
    options: {
      host: configService.get<string>('transport.host') || '0.0.0.0',
      port: configService.get<number>('transport.port') || 4002,
    },
  });

  await app.startAllMicroservices();
  await app.listen(port, host);

  logger.log(`Insurance portal service running at: ${appBaseUrl}`);
  logger.log(`Swagger docs available at: ${appBaseUrl}/api-documentation`);
}

void bootstrap();
