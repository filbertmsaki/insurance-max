import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const port = Number(process.env.FINANCE_PORT ?? '3102');
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('FINANCE_PORT must be a valid TCP port.');
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.enableShutdownHooks();
  await app.listen(port, '127.0.0.1');
}
void bootstrap();
