import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Device } from './entities/device.entity';
import { DevicesService } from './devices.service';
import { DevicesController } from './devices.controller';

import { SessionsModule } from '../sessions/sessions.module';
import { TwoFaModule } from '../auth/2fa/2fa.module';

@Module({
  imports: [TypeOrmModule.forFeature([Device]), SessionsModule, TwoFaModule],
  providers: [DevicesService],
  controllers: [DevicesController],
  exports: [DevicesService],
})
export class DevicesModule {}
