import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinanceAccountingModule } from '../../accounting/finance-accounting.module';
import { FinanceReceivablesModule } from '../../receivables/finance-receivables.module';
import { FinanceProviderEvent } from './entities/finance-provider-event.entity';
import { FinanceWebhookController } from './finance-webhook.controller';
import { PaymentPayloadRedactionService } from './payment-payload-redaction.service';
import { PaymentProviderRegistry } from './payment-provider.registry';
import { PaymentTransactionProviderService } from './payment-transaction-provider.service';
import { ProviderWebhookService } from './provider-webhook.service';

/**
 * Payment-provider adapters and signed webhooks. A verified provider event is
 * recorded once (provider event id) and settled through FinanceReceivablesModule's
 * auto-receipt path, so this module sits above receivables.
 */
@Module({
  imports: [
    FinanceAccountingModule,
    FinanceReceivablesModule,
    TypeOrmModule.forFeature([FinanceProviderEvent]),
  ],
  controllers: [FinanceWebhookController],
  providers: [
    PaymentPayloadRedactionService,
    PaymentProviderRegistry,
    PaymentTransactionProviderService,
    ProviderWebhookService,
  ],
  exports: [
    PaymentPayloadRedactionService,
    PaymentProviderRegistry,
    PaymentTransactionProviderService,
    ProviderWebhookService,
  ],
})
export class FinancePaymentProvidersModule {}
