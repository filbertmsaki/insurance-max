import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TiramisController } from './controllers/tiramis.controller';
import { TiramisMessageController } from './controllers/tiramis.message.controller';
import { TiramisItemEntity } from './entities/tiramis-item.entity';
import { TiramisService } from './services/tiramis.service';

@Module({
  imports: [TypeOrmModule.forFeature([TiramisItemEntity])],
  controllers: [TiramisController, TiramisMessageController],
  providers: [TiramisService],
  exports: [TiramisService],
})
export class TiramisModule {}
