import { registerAs } from '@nestjs/config';

import { DEFAULT_DATABASE_TYPE } from '../constants/database.constants';
import {
  ServiceDatabaseConfig,
  SupportedDatabase,
} from '../types/service-database-config.interface';

interface DatabaseDefaults extends Partial<ServiceDatabaseConfig> {
  type?: SupportedDatabase;
}

export function readDatabaseEnv(
  prefix: string,
  defaults: DatabaseDefaults = {},
): ServiceDatabaseConfig {
  return {
    type: (process.env[`${prefix}_TYPE`] ||
      defaults.type ||
      DEFAULT_DATABASE_TYPE) as SupportedDatabase,
    host: process.env[`${prefix}_HOST`] || defaults.host || 'localhost',
    port: Number(process.env[`${prefix}_PORT`] || defaults.port || 5432),
    username:
      process.env[`${prefix}_USERNAME`] || defaults.username || 'postgres',
    password:
      process.env[`${prefix}_PASSWORD`] || defaults.password || 'password',
    database:
      process.env[`${prefix}_DATABASE`] ||
      process.env[`${prefix}_NAME`] ||
      defaults.database ||
      'insurance_max',
    schema: process.env[`${prefix}_SCHEMA`] || defaults.schema || undefined,
    connectString:
      process.env[`${prefix}_ORACLE_CONNECT_STRING`] ||
      defaults.connectString ||
      '',
    synchronize:
      process.env[`${prefix}_SYNCHRONIZE`] === 'true' ||
      defaults.synchronize === true,
    logging:
      process.env[`${prefix}_LOGGING`] === 'true' || defaults.logging === true,
    ssl: process.env[`${prefix}_SSL`] === 'true' || defaults.ssl === true,
  };
}

export function createDatabaseConfigFactory(
  namespace: string,
  prefix: string,
  defaults: DatabaseDefaults = {},
) {
  return registerAs(namespace, () => readDatabaseEnv(prefix, defaults));
}
