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
import { TiramisItemEntity } from './modules/tiramis/entities/tiramis-item.entity';
import { TiramisModule } from './modules/tiramis/tiramis.module';

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
            entities: [TiramisItemEntity],
          },
        ),
    }),
    TiramisModule,
  ],
})
export class AppModule {}
