import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TiramisHttpModule } from '../../../integrations/tiramis/tiramis-http.module';
import { ApiClientsModule } from '../../platform/api-clients/api-clients.module';
import { Branch } from '../branches/entities/branch.entity';
import { IssuanceModule } from '../issuance/issuance.module';
import { Policy } from '../policies/entities/policy.entity';
import { PolicyTransaction } from '../policy-transactions/entities/policy-transaction.entity';
import { PolicyTransactionsModule } from '../policy-transactions/policy-transactions.module';
import { PolicyStatusHistory } from '../policies/entities/policy-status-history.entity';
import { QuotationStatusHistory } from '../quotations/entities/quotation-status-history.entity';
import { Quotation } from '../quotations/entities/quotation.entity';
import { QuotationsModule } from '../quotations/quotations.module';
import { TiramisSalePointEntity } from '../../tiramis/entities/tiramis-sale-point.entity';
import { TiramisCompanyConfigurationEntity } from '../../tiramis/entities/tiramis-company-configuration.entity';
import { TiramisModule } from '../../tiramis/tiramis.module';
import { IdentifierGeneratorService } from '../../shared/identifiers/identifier-generator.service';
import { TiramisClientService } from './tiramis-client.service';
import { PortalTiraSubmissionEvent } from './entities/portal-tira-submission-event.entity';
import { PortalTiraSubmission } from './entities/portal-tira-submission.entity';
import { TiramisNotificationReceipt } from './entities/tiramis-notification-receipt.entity';
import { TiramisWebhookSignatureService } from './services/tiramis-webhook-signature.service';
import { TiramisIntegrationController } from './tiramis-integration.controller';
import { TiramisIntegrationWebhookController } from './tiramis-integration-webhook.controller';
import { TiramisSourceIpDetectionController } from './tiramis-source-ip-detection.controller';
import { TiramisIntegrationService } from './tiramis-integration.service';

@Module({
  imports: [
    IssuanceModule,
    forwardRef(() => PolicyTransactionsModule),
    QuotationsModule,
    TiramisModule,
    TypeOrmModule.forFeature([
      PortalTiraSubmission,
      PortalTiraSubmissionEvent,
      Policy,
      PolicyTransaction,
      PolicyStatusHistory,
      QuotationStatusHistory,
      Quotation,
      Branch,
      TiramisSalePointEntity,
      TiramisCompanyConfigurationEntity,
      TiramisNotificationReceipt,
    ]),
    TiramisHttpModule,
    ApiClientsModule,
  ],
  controllers: [
    TiramisIntegrationController,
    TiramisIntegrationWebhookController,
    TiramisSourceIpDetectionController,
  ],
  providers: [
    TiramisIntegrationService,
    TiramisClientService,
    TiramisWebhookSignatureService,
    IdentifierGeneratorService,
  ],
  exports: [TiramisIntegrationService, TiramisClientService],
})
export class TiramisIntegrationModule {}
