import 'reflect-metadata';

import { config as loadEnv } from 'dotenv';
import { existsSync } from 'fs';
import { join } from 'path';
import { DataSource, DataSourceOptions } from 'typeorm';
import { SeederOptions } from 'typeorm-extension';

import {
  createDataSourceOptions,
  readDatabaseEnv,
} from '@insurance-max/shared-config';

const environment =
  process.env.NODE_ENV || process.env.APP_ENV || 'development';
const envPaths = [
  join(
    process.cwd(),
    'apps',
    'insurance-portal-service',
    `.env.${environment}`,
  ),
  join(process.cwd(), 'apps', 'insurance-portal-service', '.env'),
];

for (const envPath of envPaths) {
  if (existsSync(envPath)) {
    loadEnv({ path: envPath });
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

const AppDataSource = new DataSource(
  createDataSourceOptions(database, {
    entities: ['apps/insurance-portal-service/src/**/*.entity{.ts,.js}'],
    migrations: [
      'apps/insurance-portal-service/src/database/migrations/*{.ts,.js}',
    ],
    migrationsTableName: 'migrations',
    seeds: ['apps/insurance-portal-service/src/database/seeds/*.seed.ts'],
    factories: [
      'apps/insurance-portal-service/src/database/factories/*.factory{.ts,.js}',
    ],
  } as Partial<DataSourceOptions & SeederOptions>),
);

export default AppDataSource;
