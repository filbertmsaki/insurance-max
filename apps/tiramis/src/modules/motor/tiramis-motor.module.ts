import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TiramisConfigModule } from '../config/tiramis-config.module';
import { TiramisCoverNotesModule } from '../cover-notes/tiramis-cover-notes.module';
import { TiramisMessagingModule } from '../messaging/tiramis-messaging.module';
import { TiramisSharedModule } from '../shared/tiramis-shared.module';
import { TiramisSubmissionsModule } from '../submissions/tiramis-submissions.module';
import { TiramisMotorController } from './controllers/tiramis-motor.controller';
import { TiramisMotorDetailEntity } from './entities/tiramis-motor-detail.entity';
import { TiramisMotorFleetItemEntity } from './entities/tiramis-motor-fleet-item.entity';
import { TiramisMotorFleetEntity } from './entities/tiramis-motor-fleet.entity';
import { TiramisMotorRepository } from './repositories/tiramis-motor.repository';
import { TiramisMotorPayloadService } from './services/tiramis-motor-payload.service';
import { TiramisMotorService } from './services/tiramis-motor.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TiramisMotorFleetEntity,
      TiramisMotorFleetItemEntity,
      TiramisMotorDetailEntity,
    ]),
    TiramisConfigModule,
    TiramisCoverNotesModule,
    TiramisMessagingModule,
    TiramisSharedModule,
    TiramisSubmissionsModule,
  ],
  controllers: [TiramisMotorController],
  providers: [
    TiramisMotorRepository,
    TiramisMotorPayloadService,
    TiramisMotorService,
  ],
  exports: [
    TiramisMotorRepository,
    TiramisMotorPayloadService,
    TiramisMotorService,
  ],
})
export class TiramisMotorModule {}
