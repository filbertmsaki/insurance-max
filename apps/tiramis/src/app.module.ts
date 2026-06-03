import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  ServiceDatabaseConfig,
  SharedConfigModule,
  appConfig,
  createTypeOrmOptions,
  loggerConfig,
} from '@insurance-max/shared-config';

import tiramisAppConfig from './config/app.config';
import databaseConfig from './config/database.config';
import { tiramisEnvValidationSchema } from './config/env.validation';
import transportConfig from './config/transport.config';
import { TiramisConfigModule } from './modules/config/tiramis-config.module';
import { TiramisClientConfigurationEntity } from './modules/config/entities/tiramis-client-configuration.entity';
import { TiramisServiceEndpointEntity } from './modules/config/entities/tiramis-service-endpoint.entity';

@Module({
  imports: [
    SharedConfigModule.forRoot({
      appName: 'tiramis',
      validationSchema: tiramisEnvValidationSchema,
      load: [
        appConfig,
        loggerConfig,
        tiramisAppConfig,
        transportConfig,
        databaseConfig,
      ],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        createTypeOrmOptions(
          configService.getOrThrow<ServiceDatabaseConfig>('tiramisDatabase'),
          {
            autoLoadEntities: true,
            entities: [
              TiramisClientConfigurationEntity,
              TiramisServiceEndpointEntity,
            ],
          },
        ),
    }),
    TiramisConfigModule,
  ],
})
export class AppModule {}
