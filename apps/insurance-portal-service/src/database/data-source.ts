import 'reflect-metadata';

import { config as loadEnv } from 'dotenv';
import { existsSync } from 'fs';
import { join } from 'path';
import { DataSource } from 'typeorm';

import { environment } from '@insurance-max/shared-config';

import {
  createAppDataSourceOptions,
  readAppDatabaseEnv,
} from './data-source.options';

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

const AppDataSource = new DataSource(
  createAppDataSourceOptions(readAppDatabaseEnv()),
);

export default AppDataSource;
