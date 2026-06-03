import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  const globalPrefix = configService.get<string>('app.globalPrefix');
  if (globalPrefix) {
    app.setGlobalPrefix(globalPrefix);
  }

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.TCP,
    options: {
      host: configService.get<string>('transport.host') || '0.0.0.0',
      port: configService.get<number>('transport.port') || 4001,
    },
  });

  await app.startAllMicroservices();
  await app.listen(configService.get<number>('app.port') || 3001);
}

void bootstrap();
