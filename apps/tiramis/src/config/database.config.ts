import { createDatabaseConfigFactory } from '@insurance-max/shared-config';

export default createDatabaseConfigFactory('tiramisDatabase', 'DB', {
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  username: 'postgres',
  password: '',
  database: 'alliance_db',
  synchronize: false,
  logging: false,
  ssl: false,
});
