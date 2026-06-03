import { DynamicModule, Module } from '@nestjs/common';
import { ConfigFactory, ConfigModule } from '@nestjs/config';
import type { ObjectSchema } from 'joi';
import { join } from 'path';

export interface SharedConfigModuleOptions {
  appName: string;
  load?: ConfigFactory[];
  validationSchema?: ObjectSchema;
  envFilePath?: string[];
}

@Module({})
export class SharedConfigModule {
  static forRoot(options: SharedConfigModuleOptions): DynamicModule {
    const environment =
      process.env.NODE_ENV || process.env.APP_ENV || 'development';
    const envFilePath = options.envFilePath || [
      join(process.cwd(), 'apps', options.appName, `.env.${environment}`),
      join(process.cwd(), 'apps', options.appName, '.env'),
      `.env.${options.appName}.${environment}`,
      `.env.${options.appName}`,
      `.env.${environment}`,
      '.env',
    ];

    return {
      module: SharedConfigModule,
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          cache: true,
          envFilePath,
          load: options.load || [],
          validationSchema: options.validationSchema,
          validationOptions: {
            abortEarly: false,
            allowUnknown: true,
          },
        }),
      ],
      exports: [ConfigModule],
    };
  }
}
