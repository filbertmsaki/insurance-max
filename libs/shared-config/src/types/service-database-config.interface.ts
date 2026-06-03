export type SupportedDatabase = 'postgres' | 'mysql' | 'oracle';

export interface ServiceDatabaseConfig {
  type: SupportedDatabase;
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  connectString?: string;
  synchronize: boolean;
  logging: boolean;
  ssl: boolean;
}
