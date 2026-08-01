import * as bodyParser from 'body-parser';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { buildUrl } from '@insurance-max/shared-config';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
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
    app.setGlobalPrefix(globalPrefix);
  }

  const swaggerConfig = new DocumentBuilder()
    .setTitle(configService.getOrThrow<string>('app.name'))
    .setDescription('Tiramis service API documentation')
    .setVersion(configService.get<string>('app.version') || 'v1')
    .addServer(apiBaseUrl)
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, swaggerDocument, {
    useGlobalPrefix: true,
  });

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.TCP,
    options: {
      host: configService.getOrThrow<string>('transport.host'),
      port: configService.getOrThrow<number>('transport.port'),
    },
  });

  await app.startAllMicroservices();
  await app.listen(appPort, appHost);

  logger.log(`Tiramis service running at: ${appBaseUrl}`);
  logger.log(`Tiramis API base available at: ${apiBaseUrl}`);
  logger.log(`Swagger docs available at: ${docsUrl}`);
}

void bootstrap();
