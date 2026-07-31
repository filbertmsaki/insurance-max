import * as bodyParser from 'body-parser';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');
  const appHost = configService.get<string>('app.host') || '127.0.0.1';
  const appPort = configService.get<number>('app.port') || 9090;
  const globalPrefix = configService.get<string>('app.globalPrefix') || '';
  const browserHost =
    appHost === '0.0.0.0' || appHost === '127.0.0.1' || appHost === '::'
      ? 'localhost'
      : appHost;
  const appBaseUrl = `http://${browserHost}:${appPort}`;
  const apiBaseUrl = globalPrefix
    ? `${appBaseUrl}/${globalPrefix}`
    : appBaseUrl;
  const docsUrl = globalPrefix
    ? `${appBaseUrl}/${globalPrefix}/docs`
    : `${appBaseUrl}/docs`;

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
    .setTitle('Tiramis API')
    .setDescription('Tiramis service API documentation')
    .setVersion(configService.get<string>('app.version') || 'v1')
    .addServer(appBaseUrl)
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, swaggerDocument, {
    useGlobalPrefix: true,
  });

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.TCP,
    options: {
      host: configService.get<string>('transport.host') || '0.0.0.0',
      port: configService.get<number>('transport.port') || 4001,
    },
  });

  await app.startAllMicroservices();
  await app.listen(appPort, appHost);

  logger.log(`Tiramis service running at: ${appBaseUrl}`);
  logger.log(`Tiramis API base available at: ${apiBaseUrl}`);
  logger.log(`Swagger docs available at: ${docsUrl}`);
}

void bootstrap();
