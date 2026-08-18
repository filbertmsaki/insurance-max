import 'reflect-metadata';

import { config as loadEnv } from 'dotenv';
import { existsSync } from 'fs';
import { join, resolve, sep } from 'path';
import { DataSource, DataSourceOptions } from 'typeorm';
import { SeederOptions } from 'typeorm-extension';

import {
  createDataSourceOptions,
  environment,
  readDatabaseEnv,
} from '@insurance-max/shared-config';

const environmentName =
  environment.NODE_ENV || environment.APP_ENV || 'development';
const envPaths = [
  join(process.cwd(), 'apps', 'insurance-portal-service', '.env'),
  join(
    process.cwd(),
    'apps',
    'insurance-portal-service',
    `.env.${environmentName}`,
  ),
];

for (const envPath of envPaths) {
  if (existsSync(envPath)) {
    loadEnv({ path: envPath, override: true });
  }
}

const database = readDatabaseEnv('DB', {
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

const runtimeExtension = __filename.endsWith('.ts') ? 'ts' : 'js';

// __dirname is .../src/database both when running from TypeScript source
// and from the compiled dist output, so globs built from it resolve
// correctly regardless of process.cwd() or which environment runs them.
// glob patterns must use forward slashes even on Windows, so the path
// is normalized rather than joined with the platform separator.
const srcRoot = resolve(__dirname, '..').split(sep).join('/');

const AppDataSource = new DataSource(
  createDataSourceOptions(database, {
    entities: [`${srcRoot}/**/*.entity.${runtimeExtension}`],
    migrations: [`${srcRoot}/database/migrations/*.${runtimeExtension}`],
    migrationsTableName: 'migrations',
    seeds: [`${srcRoot}/database/seeds/*.seed.${runtimeExtension}`],
    factories: [`${srcRoot}/database/factories/*.factory.${runtimeExtension}`],
  } as Partial<DataSourceOptions & SeederOptions>),
);

export default AppDataSource;
