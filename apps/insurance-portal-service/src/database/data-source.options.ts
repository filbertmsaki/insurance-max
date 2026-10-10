import { resolve, sep } from 'path';
import { DataSourceOptions } from 'typeorm';
import { SeederOptions } from 'typeorm-extension';

import {
  ServiceDatabaseConfig,
  createDataSourceOptions,
  readDatabaseEnv,
} from '@insurance-max/shared-config';

// Kept free of side effects (no env file loading) so test tooling can build
// the same options against a disposable database without data-source.ts
// overwriting process.env.
export function readAppDatabaseEnv(): ServiceDatabaseConfig {
  return readDatabaseEnv('DB', {
    type: 'postgres',
    host: 'localhost',
    port: 5432,
    username: 'postgres',
    password: 'root',
    database: 'insurance_portal_db',
    synchronize: false,
    logging: true,
    ssl: false,
  });
}

export function createAppDataSourceOptions(
  database: ServiceDatabaseConfig,
): DataSourceOptions {
  const runtimeExtension = __filename.endsWith('.ts') ? 'ts' : 'js';

  // __dirname is .../src/database both when running from TypeScript source
  // and from the compiled dist output, so globs built from it resolve
  // correctly regardless of process.cwd() or which environment runs them.
  // glob patterns must use forward slashes even on Windows, so the path
  // is normalized rather than joined with the platform separator.
  const srcRoot = resolve(__dirname, '..').split(sep).join('/');

  return createDataSourceOptions(database, {
    entities: [`${srcRoot}/**/*.entity.${runtimeExtension}`],
    migrations: [`${srcRoot}/database/migrations/*.${runtimeExtension}`],
    migrationsTableName: 'migrations',
    seeds: [`${srcRoot}/database/seeds/*.seed.${runtimeExtension}`],
    factories: [`${srcRoot}/database/factories/*.factory.${runtimeExtension}`],
  } as Partial<DataSourceOptions & SeederOptions>);
}
