import { DataSource } from 'typeorm';
import { financeDatabaseOptions } from './options';

export default new DataSource(financeDatabaseOptions(process.env));
