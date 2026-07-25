import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Branch } from '../branches/entities/branch.entity';
import { Policy } from '../policies/entities/policy.entity';
import { PolicyStatusHistory } from '../policies/entities/policy-status-history.entity';
import { QuotationStatusHistory } from '../quotations/entities/quotation-status-history.entity';
import { Quotation } from '../quotations/entities/quotation.entity';
import { QuotationsModule } from '../quotations/quotations.module';
import { TiramisSalePointEntity } from '../../tiramis/entities/tiramis-sale-point.entity';
import { TiramisModule } from '../../tiramis/tiramis.module';
import { IdentifierGeneratorService } from '../../shared/identifiers/identifier-generator.service';
import { TiramisClientService } from './tiramis-client.service';
import { PortalTiraSubmissionEvent } from './entities/portal-tira-submission-event.entity';
import { PortalTiraSubmission } from './entities/portal-tira-submission.entity';
import { TiramisIntegrationController } from './tiramis-integration.controller';
import { TiramisIntegrationListener } from './tiramis-integration.listener';
import { TiramisIntegrationService } from './tiramis-integration.service';

@Module({
  imports: [
    QuotationsModule,
    TiramisModule,
    TypeOrmModule.forFeature([
      PortalTiraSubmission,
      PortalTiraSubmissionEvent,
      Policy,
      PolicyStatusHistory,
      QuotationStatusHistory,
      Quotation,
      Branch,
      TiramisSalePointEntity,
    ]),
    ClientsModule.register([
      {
        name: 'TIRAMIS_SERVICE_CLIENT',
        transport: Transport.TCP,
        options: {
          host: process.env.TIRAMIS_TCP_HOST || '127.0.0.1',
          port: Number(process.env.TIRAMIS_TCP_PORT || 4001),
        },
      },
    ]),
  ],
  controllers: [TiramisIntegrationController, TiramisIntegrationListener],
  providers: [
    TiramisIntegrationService,
    TiramisClientService,
    IdentifierGeneratorService,
  ],
  exports: [TiramisIntegrationService, TiramisClientService],
})
export class TiramisIntegrationModule {}
