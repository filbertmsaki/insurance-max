import { createDatabaseConfigFactory } from '@insurance-max/shared-config';

export default createDatabaseConfigFactory('insurancePortalDatabase', 'DB', {
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
