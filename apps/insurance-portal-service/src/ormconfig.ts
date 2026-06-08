import { TypeOrmModuleOptions } from '@nestjs/typeorm';

import AppDataSource from './database/data-source';

export const typeOrmConfig = AppDataSource.options as TypeOrmModuleOptions;
