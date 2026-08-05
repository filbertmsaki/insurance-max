import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  ServiceDatabaseConfig,
  SharedConfigModule,
  cacheConfig,
  corsConfig,
  createTypeOrmOptions,
  loggerConfig,
  mailConfig,
  queueConfig,
  redisConfig,
} from '@insurance-max/shared-config';

import {
  ApiExceptionFilter,
  ApiLoggingInterceptor,
  ApiResponseInterceptor,
  RequestContextModule,
  ServiceAuthModule,
} from '@insurance-max/shared-kernel';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import { insurancePortalEnvValidationSchema } from './config/env.validation';
import jwtConfig from './config/jwt.config';
import tiramisClientConfig from './config/tiramis-client.config';
import { HealthModule } from './health/health.module';
import { InsurancePortalServiceModule } from './modules/insurance-portal-service.module';
import { TiramisModule } from './modules/tiramis/tiramis.module';

@Module({
  imports: [
    SharedConfigModule.forRoot({
      appName: 'insurance-portal-service',
      validationSchema: insurancePortalEnvValidationSchema,
      load: [
        appConfig,
        loggerConfig,
        cacheConfig,
        corsConfig,
        redisConfig,
        queueConfig,
        mailConfig,
        databaseConfig,
        jwtConfig,
        tiramisClientConfig,
      ],
    }),

    RequestContextModule,
    ServiceAuthModule,

    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => [
        {
          name: 'default',
          ttl: Number(configService.get<string>('THROTTLER_TTL') ?? 60000),
          limit: Number(configService.get<string>('THROTTLER_LIMIT') ?? 100),
        },
      ],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        createTypeOrmOptions(
          configService.getOrThrow<ServiceDatabaseConfig>(
            'insurancePortalDatabase',
          ),
          {
            autoLoadEntities: true,
            entities: [__dirname + '/**/*.entity{.ts,.js}'],
          },
        ),
    }),
    InsurancePortalServiceModule,
    TiramisModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,

    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },

    {
      provide: APP_FILTER,
      useClass: ApiExceptionFilter,
    },

    {
      provide: APP_INTERCEPTOR,
      useClass: ApiResponseInterceptor,
    },

    {
      provide: APP_INTERCEPTOR,
      useClass: ApiLoggingInterceptor,
    },
  ],
})
export class AppModule {}
