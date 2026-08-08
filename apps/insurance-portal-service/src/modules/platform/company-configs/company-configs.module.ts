import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CompanyConfigsController } from './company-configs.controller';
import { CompanyConfigsService } from './company-configs.service';
import { CompanyConfig } from './entities/company-config.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CompanyConfig])],
  controllers: [CompanyConfigsController],
  providers: [CompanyConfigsService],
  exports: [CompanyConfigsService],
})
export class CompanyConfigsModule {}
