import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSourceOptions } from 'typeorm';

import { ServiceDatabaseConfig } from '../types/service-database-config.interface';

export function createTypeOrmOptions(
  database: ServiceDatabaseConfig,
  overrides: Partial<TypeOrmModuleOptions> = {},
): TypeOrmModuleOptions {
  const baseOptions = {
    type: database.type,
    host: database.host,
    port: database.port,
    username: database.username,
    password: database.password,
    database: database.database,
    synchronize: database.synchronize,
    logging: database.logging,
    ssl: database.ssl,
    ...overrides,
  };

  if (database.type === 'oracle') {
    return {
      ...baseOptions,
      connectString: database.connectString,
    } as TypeOrmModuleOptions;
  }

  return baseOptions as TypeOrmModuleOptions;
}

export function createDataSourceOptions(
  database: ServiceDatabaseConfig,
  overrides: Partial<DataSourceOptions> = {},
): DataSourceOptions {
  return createTypeOrmOptions(database, overrides) as DataSourceOptions;
}
