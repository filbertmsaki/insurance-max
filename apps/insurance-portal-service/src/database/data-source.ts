import 'reflect-metadata';

import { config as loadEnv } from 'dotenv';
import { existsSync } from 'fs';
import { join } from 'path';
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

const AppDataSource = new DataSource(
  createDataSourceOptions(database, {
    entities: [
      `apps/insurance-portal-service/src/**/*.entity.${runtimeExtension}`,
    ],
    migrations: [
      `apps/insurance-portal-service/src/database/migrations/*.${runtimeExtension}`,
    ],
    migrationsTableName: 'migrations',
    seeds: [
      `apps/insurance-portal-service/src/database/seeds/*.seed.${runtimeExtension}`,
    ],
    factories: [
      `apps/insurance-portal-service/src/database/factories/*.factory.${runtimeExtension}`,
    ],
  } as Partial<DataSourceOptions & SeederOptions>),
);

export default AppDataSource;
