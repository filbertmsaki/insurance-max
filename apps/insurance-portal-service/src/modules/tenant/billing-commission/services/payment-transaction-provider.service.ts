import { ConflictException, Injectable } from '@nestjs/common';
import { PaymentTransactionStatus } from '@insurance-max/contracts';
import { EntityManager } from 'typeorm';

import { DecimalUtil } from '../../../shared/finance/decimal.util';
import { IdentifierGeneratorService } from '../../../shared/identifiers/identifier-generator.service';
import { Invoice } from '../entities/invoice.entity';
import { PaymentTransaction } from '../entities/payment-transaction.entity';
import { PaymentProviderEvent } from '../providers/payment-provider.adapter';

@Injectable()
export class PaymentTransactionProviderService {
  constructor(private readonly identifierService: IdentifierGeneratorService) {}

  async applyProviderEvent(
    manager: EntityManager,
    event: PaymentProviderEvent,
    payloadHash: string,
    payloadRedacted: Record<string, unknown>,
  ): Promise<PaymentTransaction | null> {
    const existing = await this.findExistingTransaction(manager, event);

    if (existing) {
      if (
        !this.canApplyStatusTransition(
          existing.status as PaymentTransactionStatus,
          event.status,
        )
      ) {
        throw new ConflictException({
          code: 'PAYMENT_PROVIDER_STATE_REGRESSION',
          message:
            'The provider event attempted to move the payment transaction backwards.',
        });
      }

      existing.status = event.status;
      existing.provider_event_id = event.eventId;
      existing.payment_method = existing.payment_method ?? null;
      existing.provider_payload_hash = payloadHash;
      existing.provider_payload_redacted = payloadRedacted;
      existing.payer_name = event.payerName ?? existing.payer_name;
      existing.payer_phone = event.payerPhone ?? existing.payer_phone;
      existing.payer_email = event.payerEmail ?? existing.payer_email;
      existing.payment_reference =
        event.paymentReference ?? existing.payment_reference;
      existing.received_at = event.receivedAt ?? existing.received_at;
      existing.settled_at = event.settledAt ?? existing.settled_at;

      if (
        event.status === PaymentTransactionStatus.FAILED ||
        event.status === PaymentTransactionStatus.CANCELLED ||
        event.status === PaymentTransactionStatus.EXPIRED
      ) {
        existing.failed_at = event.receivedAt ?? new Date();
      }

      return manager.getRepository(PaymentTransaction).save(existing);
    }

    const invoice = await this.resolveInvoiceByReference(manager, event);

    if (!invoice) {
      return null;
    }

    const transactionNo =
      await this.identifierService.generatePaymentTransactionNumber(
        invoice.company_id,
        manager,
      );

    return manager.getRepository(PaymentTransaction).save(
      manager.getRepository(PaymentTransaction).create({
        company_id: invoice.company_id,
        customer_id: invoice.customer_id,
        invoice_id: invoice.id,
        receipt_id: null,
        transaction_no: transactionNo,
        provider: event.providerCode,
        provider_code: event.providerCode,
        provider_reference: event.paymentReference ?? transactionNo,
        provider_transaction_id: event.providerTransactionId,
        provider_event_id: event.eventId,
        internal_reference: transactionNo,
        payment_method: null,
        status: event.status,
        amount: DecimalUtil.value(event.amount).toFixed(4),
        currency: event.currencyCode.trim().toUpperCase(),
        provider_amount: DecimalUtil.value(event.amount).toFixed(4),
        provider_currency_code: event.currencyCode.trim().toUpperCase(),
        exchange_rate: DecimalUtil.rate(1),
        payer_name: event.payerName,
        payer_phone: event.payerPhone,
        payer_email: event.payerEmail,
        payment_reference: event.paymentReference,
        provider_payload_hash: payloadHash,
        provider_payload_redacted: payloadRedacted,
        received_at: event.receivedAt,
        settled_at: event.settledAt,
        failed_at:
          event.status === PaymentTransactionStatus.FAILED
            ? (event.receivedAt ?? new Date())
            : null,
      }),
    );
  }

  private async findExistingTransaction(
    manager: EntityManager,
    event: PaymentProviderEvent,
  ): Promise<PaymentTransaction | null> {
    const repository = manager.getRepository(PaymentTransaction);

    if (event.providerTransactionId?.trim()) {
      const byProviderTransaction = await repository.findOne({
        where: {
          provider_code: event.providerCode,
          provider_transaction_id: event.providerTransactionId.trim(),
        },
      });

      if (byProviderTransaction) {
        return byProviderTransaction;
      }
    }

    if (event.eventId.trim()) {
      return repository.findOne({
        where: {
          provider_code: event.providerCode,
          provider_event_id: event.eventId.trim(),
        },
      });
    }

    return null;
  }

  private async resolveInvoiceByReference(
    manager: EntityManager,
    event: PaymentProviderEvent,
  ): Promise<Invoice | null> {
    const paymentReference = event.paymentReference?.trim();

    if (!paymentReference) {
      return null;
    }

    const matches = await manager.getRepository(Invoice).find({
      where: {
        invoice_no: paymentReference,
      },
      take: 2,
    });

    return matches.length === 1 ? matches[0] : null;
  }

  private canApplyStatusTransition(
    current: PaymentTransactionStatus,
    next: PaymentTransactionStatus,
  ): boolean {
    if (current === next) {
      return true;
    }

    switch (current) {
      case PaymentTransactionStatus.INITIATED:
      case PaymentTransactionStatus.PENDING:
        return (
          next === PaymentTransactionStatus.PENDING ||
          next === PaymentTransactionStatus.SUCCESSFUL ||
          next === PaymentTransactionStatus.FAILED ||
          next === PaymentTransactionStatus.CANCELLED ||
          next === PaymentTransactionStatus.EXPIRED
        );

      case PaymentTransactionStatus.SUCCESSFUL:
        return (
          next === PaymentTransactionStatus.PARTIALLY_REFUNDED ||
          next === PaymentTransactionStatus.REFUNDED ||
          next === PaymentTransactionStatus.REVERSED
        );

      case PaymentTransactionStatus.PARTIALLY_REFUNDED:
        return next === PaymentTransactionStatus.REFUNDED;

      default:
        return false;
    }
  }
}
