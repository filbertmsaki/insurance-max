import {
  ConflictException,
  HttpException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ProductDefinitionHashService } from '@insurance-max/shared-kernel';
import { DataSource } from 'typeorm';

import { FinanceProviderEvent } from './entities/finance-provider-event.entity';
import { FinanceAutoReceiptService } from '../../receivables/receipts/finance-auto-receipt.service';
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
    if (
      typeof event.providerCode !== 'string' ||
      event.providerCode.trim().toUpperCase() !==
        adapter.providerCode.trim().toUpperCase()
    ) {
      throw new UnauthorizedException('Payment-provider identity mismatch.');
    }
    event.providerCode = adapter.providerCode.trim().toUpperCase();
    const payloadRedacted = this.redactionService.redactPaymentPayload(
      event.rawPayload,
    );
    const payloadHash = this.hashService.hashDefinition(event.rawPayload);

    return this.dataSource.transaction(async (manager) => {
      await manager.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1,0))',
        [`provider-event:${event.providerCode}:${event.eventId}`],
      );
      const eventRepository = manager.getRepository(FinanceProviderEvent);
      const existing = await eventRepository.findOne({
        where: {
          provider_code: event.providerCode,
          provider_event_id: event.eventId,
        },
      });

      if (existing && existing.payload_hash !== payloadHash)
        throw new ConflictException(
          'Provider event identity was reused with different content. Reconciliation is required.',
        );
      if (existing?.status === 'PROCESSED') {
        return {
          accepted: true,
          duplicate: true,
          paymentTransactionId: existing.payment_transaction_id,
          ...(existing.processing_error ? { accountingHeld: true } : {}),
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
        eventRecord.status = 'RECEIVED';
        await eventRepository.save(eventRecord);
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
          // Confirmed provider cash must survive an accounting/configuration
          // failure. Roll back only its receipt/journal/allocation attempt.
          await manager.query('SAVEPOINT provider_accounting');
          try {
            await this.autoReceiptService.postWhenEligible(
              manager,
              transaction,
            );
            await manager.query('RELEASE SAVEPOINT provider_accounting');
          } catch (error) {
            await manager.query('ROLLBACK TO SAVEPOINT provider_accounting');
            await manager.query('RELEASE SAVEPOINT provider_accounting');
            const response =
              error instanceof HttpException ? error.getResponse() : null;
            const details =
              response && typeof response === 'object'
                ? (response as { code?: unknown; message?: unknown })
                : null;
            const code =
              typeof details?.code === 'string' &&
              /^[A-Z0-9_]{1,100}$/.test(details.code)
                ? details.code
                : 'ACCOUNTING_PROCESSING_FAILED';
            const sqlState =
              error &&
              typeof error === 'object' &&
              'code' in error &&
              typeof error.code === 'string' &&
              /^[0-9A-Z]{5}$/.test(error.code)
                ? error.code
                : null;
            eventRecord.processing_error =
              'ACCOUNTING_HELD: ' +
              JSON.stringify({
                code,
                sqlState,
                message:
                  code === 'FINANCE_POSTING_HELD'
                    ? details?.message
                    : 'Confirmed payment retained. Receipt, journal and allocation creation rolled back; controlled reconciliation and replay are required.',
              });
            await eventRepository.save(eventRecord);
            return {
              accepted: true,
              duplicate: false,
              resolved: true,
              paymentTransactionId: transaction.id,
              accountingHeld: true,
              accountingErrorCode: code,
            };
          }
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
