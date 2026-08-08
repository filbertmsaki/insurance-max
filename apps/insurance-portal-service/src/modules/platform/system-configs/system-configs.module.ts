import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SystemConfigEntity } from './entities/system-config.entity';
import { SystemConfigsController } from './system-configs.controller';
import { SystemConfigsService } from './system-configs.service';

@Module({
  imports: [TypeOrmModule.forFeature([SystemConfigEntity])],
  controllers: [SystemConfigsController],
  providers: [SystemConfigsService],
  exports: [SystemConfigsService],
})
export class SystemConfigsModule {}
