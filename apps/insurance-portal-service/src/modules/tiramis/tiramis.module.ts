import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TiramisController } from './controllers/tiramis.controller';
import { TiramisSubmissionTrackingEntity } from './entities/tiramis-submission-tracking.entity';
import { TiramisSubmissionTrackingRepository } from './repositories/tiramis-submission-tracking.repository';
import {
  TIRAMIS_CLIENT,
  TiramisClientService,
} from './services/tiramis-client.service';
import { TiramisStatusSyncService } from './services/tiramis-status-sync.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TiramisSubmissionTrackingEntity]),
    ClientsModule.register([
      {
        name: TIRAMIS_CLIENT,
        transport: Transport.TCP,
        options: {
          host: process.env.TIRAMIS_SERVICE_HOST || '127.0.0.1',
          port: Number(process.env.TIRAMIS_SERVICE_TCP_PORT || 9095),
        },
      },
    ]),
  ],
  controllers: [TiramisController],
  providers: [
    TiramisClientService,
    TiramisSubmissionTrackingRepository,
    TiramisStatusSyncService,
  ],
  exports: [
    TiramisClientService,
    TiramisSubmissionTrackingRepository,
    TiramisStatusSyncService,
  ],
})
export class TiramisModule {}
