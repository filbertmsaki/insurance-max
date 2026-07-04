import { Module } from '@nestjs/common';

import { TiramisListenerController } from './tiramis-listener.controller';

@Module({
  controllers: [TiramisListenerController],
})
export class TiramisListenerModule {}
