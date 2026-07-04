import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TiramisConfigModule } from '../config/tiramis-config.module';
import { TiramisMessagingModule } from '../messaging/tiramis-messaging.module';
import { TiramisSharedModule } from '../shared/tiramis-shared.module';
import { TiramisSubmissionsModule } from '../submissions/tiramis-submissions.module';
import { TiramisReinsuranceController } from './controllers/tiramis-reinsurance.controller';
import { TiramisReinsuranceParticipantEntity } from './entities/tiramis-reinsurance-participant.entity';
import { TiramisReinsuranceEntity } from './entities/tiramis-reinsurance.entity';
import { TiramisReinsuranceRepository } from './repositories/tiramis-reinsurance.repository';
import { TiramisReinsurancePayloadService } from './services/tiramis-reinsurance-payload.service';
import { TiramisReinsuranceService } from './services/tiramis-reinsurance.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TiramisReinsuranceEntity,
      TiramisReinsuranceParticipantEntity,
    ]),
    TiramisConfigModule,
    TiramisMessagingModule,
    TiramisSubmissionsModule,
    TiramisSharedModule,
  ],
  controllers: [TiramisReinsuranceController],
  providers: [
    TiramisReinsuranceRepository,
    TiramisReinsurancePayloadService,
    TiramisReinsuranceService,
  ],
  exports: [
    TiramisReinsuranceRepository,
    TiramisReinsurancePayloadService,
    TiramisReinsuranceService,
  ],
})
export class TiramisReinsuranceModule {}
