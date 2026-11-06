import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InvoiceStatus, QuotationFinanceEvent } from '@insurance-max/contracts';

import { Invoice } from '../entities/invoice.entity';
import { QuotationLifecycleService } from '../../quotations/services/quotation-lifecycle.service';

/**
 * Applies queued finance events to the quotation payment status.
 *
 * Balance events (PAYMENT_POSTED / PAYMENT_REVERSED) are applied from the
 * invoice's *current* status, not from the amounts captured when the event
 * was queued. The synchronous projection has usually applied the same state
 * already; re-deriving from the live invoice keeps replays idempotent and
 * stops an older event from moving a PAID quotation back to PARTIALLY_PAID.
 */
@Injectable()
export class QuotationPaymentEventService {
  private readonly logger = new Logger(QuotationPaymentEventService.name);

  constructor(
    private readonly quotationLifecycleService: QuotationLifecycleService,
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
  ) {}

  async apply(event: QuotationFinanceEvent) {
    const context = (requestId: string, reason: string) => ({
      source: 'SYSTEM' as const,
      changedByType: 'SYSTEM' as const,
      requestId,
      reason,
      metadata: event as unknown as Record<string, unknown>,
    });

    if (event.eventType === 'PAYMENT_FAILED') {
      return this.quotationLifecycleService.markPaymentFailed(
        event.companyId,
        event.quotationId,
        context(event.invoiceId, 'Payment failed from finance event'),
      );
    }

    if (event.eventType === 'PAYMENT_REFUNDED') {
      return this.quotationLifecycleService.markPaymentRefunded(
        event.companyId,
        event.quotationId,
        context(
          event.refundId ?? event.invoiceId,
          'Payment refunded from finance event',
        ),
      );
    }

    if (event.eventType === 'PAYMENT_PROCESSING') {
      return null;
    }

    const invoice = await this.invoiceRepository.findOne({
      where: { id: event.invoiceId, company_id: event.companyId },
    });
    if (!invoice) {
      this.logger.warn(
        `Finance event ${event.eventId} references missing invoice ${event.invoiceId}; skipped`,
      );
      return null;
    }

    if (
      invoice.source_revision != null &&
      event.workflowRevision != null &&
      Number(invoice.source_revision) !== Number(event.workflowRevision)
    ) {
      this.logger.warn(
        `Finance event ${event.eventId} is for workflow revision ${event.workflowRevision} but invoice is on ${invoice.source_revision}; skipped`,
      );
      return null;
    }

    switch (invoice.status) {
      case InvoiceStatus.PAID:
      case InvoiceStatus.OVERPAID:
        return this.quotationLifecycleService.markPaymentPaid(
          event.companyId,
          event.quotationId,
          context(invoice.id, 'Finance event confirmed invoice is paid'),
        );
      case InvoiceStatus.PARTIALLY_PAID:
        return this.quotationLifecycleService.markPartiallyPaid(
          event.companyId,
          event.quotationId,
          {
            ...context(
              event.receiptId ?? invoice.id,
              'Partial payment posted from finance event',
            ),
            paymentTransactionId: event.receiptId ?? undefined,
          },
        );
      case InvoiceStatus.ISSUED:
        return this.quotationLifecycleService.markPaymentRequested(
          event.companyId,
          event.quotationId,
          context(invoice.id, 'Payment reversed from finance event'),
        );
      default:
        // VOID / DRAFT / CANCELLED invoices carry no payment state to project.
        return null;
    }
  }
}
