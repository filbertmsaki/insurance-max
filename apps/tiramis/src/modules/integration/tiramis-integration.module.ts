import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TiramisSubmissionsModule } from '../submissions/tiramis-submissions.module';
import { TiramisIngressRequestEntity } from './entities/tiramis-ingress-request.entity';
import { TiramisIntegrationController } from './controllers/tiramis-integration.controller';
import { TiramisIngressRequestRepository } from './repositories/tiramis-ingress-request.repository';
import { TiramisIntegrationService } from './services/tiramis-integration.service';

@Module({
  imports: [
    TiramisSubmissionsModule,
    TypeOrmModule.forFeature([TiramisIngressRequestEntity]),
  ],
  controllers: [TiramisIntegrationController],
  providers: [TiramisIngressRequestRepository, TiramisIntegrationService],
  exports: [TiramisIngressRequestRepository, TiramisIntegrationService],
})
export class TiramisIntegrationModule {}
