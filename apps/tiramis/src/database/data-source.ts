import 'reflect-metadata';

import { config as loadEnv } from 'dotenv';
import { existsSync } from 'fs';
import { join } from 'path';
import { DataSource } from 'typeorm';

import {
  createDataSourceOptions,
  readDatabaseEnv,
} from '@insurance-max/shared-config';

import { TiramisClientConfigurationEntity } from '../modules/config/entities/tiramis-client-configuration.entity';
import { TiramisResponseCodeEntity } from '../modules/config/entities/tiramis-response-code.entity';
import { TiramisServiceEndpointEntity } from '../modules/config/entities/tiramis-service-endpoint.entity';
import { TiramisItemEntity } from '../modules/tiramis/entities/tiramis-item.entity';

const environment =
  process.env.NODE_ENV || process.env.APP_ENV || 'development';
const envPaths = [
  join(process.cwd(), 'apps', 'tiramis', `.env.${environment}`),
  join(process.cwd(), 'apps', 'tiramis', '.env'),
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
  password: 'password',
  database: 'alliance_db',
  synchronize: false,
  logging: true,
  ssl: false,
});

export default new DataSource(
  createDataSourceOptions(database, {
    entities: [
      TiramisItemEntity,
      TiramisClientConfigurationEntity,
      TiramisServiceEndpointEntity,
      TiramisResponseCodeEntity,
    ],
    migrations: ['apps/tiramis/src/database/migrations/*.{ts,js}'],
  }),
);
