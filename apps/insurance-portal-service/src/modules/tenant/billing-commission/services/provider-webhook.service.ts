import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ProductDefinitionHashService } from '@insurance-max/shared-kernel';
import { DataSource } from 'typeorm';

import { FinanceProviderEvent } from '../entities/finance-provider-event.entity';
import { FinanceAutoReceiptService } from './finance-auto-receipt.service';
import { PaymentPayloadRedactionService } from './payment-payload-redaction.service';
import { PaymentProviderRegistry } from './payment-provider.registry';
import { PaymentTransactionProviderService } from './payment-transaction-provider.service';

@Injectable()
export class ProviderWebhookService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly registry: PaymentProviderRegistry,
    private readonly hashService: ProductDefinitionHashService,
    private readonly redactionService: PaymentPayloadRedactionService,
    private readonly paymentTransactionProviderService: PaymentTransactionProviderService,
    private readonly autoReceiptService: FinanceAutoReceiptService,
  ) {}

  async process(
    providerCode: string,
    headers: Record<string, string>,
    rawBody: Buffer,
  ) {
    const adapter = this.registry.require(providerCode);
    const signatureValid = await adapter.verifySignature(headers, rawBody);

    if (!signatureValid) {
      throw new UnauthorizedException('Invalid payment-provider signature.');
    }

    const event = await adapter.parseEvent(headers, rawBody);
    const payloadRedacted = this.redactionService.redactPaymentPayload(
      event.rawPayload,
    );
    const payloadHash = this.hashService.hashDefinition(event.rawPayload);

    return this.dataSource.transaction(async (manager) => {
      const eventRepository = manager.getRepository(FinanceProviderEvent);
      const existing = await eventRepository.findOne({
        where: {
          provider_code: event.providerCode,
          provider_event_id: event.eventId,
        },
      });

      if (existing?.status === 'PROCESSED') {
        return {
          accepted: true,
          duplicate: true,
          paymentTransactionId: existing.payment_transaction_id,
        };
      }

      const eventRecord =
        existing ??
        eventRepository.create({
          provider_code: event.providerCode,
          provider_event_id: event.eventId,
          event_type: event.eventType,
          signature_valid: true,
          payload_hash: payloadHash,
          payload_redacted: payloadRedacted,
          status: 'RECEIVED',
        });

      try {
        const transaction =
          await this.paymentTransactionProviderService.applyProviderEvent(
            manager,
            event,
            payloadHash,
            payloadRedacted,
          );

        eventRecord.company_id = transaction?.company_id ?? null;
        eventRecord.payment_transaction_id = transaction?.id ?? null;
        eventRecord.status = transaction ? 'PROCESSED' : 'UNRESOLVED';
        eventRecord.processing_error = transaction
          ? null
          : 'No unique invoice reference could be resolved from the provider event.';
        eventRecord.processed_at = new Date();

        await eventRepository.save(eventRecord);

        if (transaction) {
          await this.autoReceiptService.postWhenEligible(manager, transaction);
        }

        return {
          accepted: true,
          duplicate: false,
          resolved: !!transaction,
          paymentTransactionId: transaction?.id ?? null,
        };
      } catch (error) {
        eventRecord.status = 'FAILED';
        eventRecord.processing_error =
          error instanceof Error
            ? error.message
            : 'Provider event processing failed.';
        await eventRepository.save(eventRecord);
        throw error;
      }
    });
  }
}
