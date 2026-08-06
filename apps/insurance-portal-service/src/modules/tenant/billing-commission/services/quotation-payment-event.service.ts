import { Injectable } from '@nestjs/common';
import { QuotationFinanceEvent } from '@insurance-max/contracts';

import { QuotationLifecycleService } from '../../quotations/services/quotation-lifecycle.service';

@Injectable()
export class QuotationPaymentEventService {
  constructor(
    private readonly quotationLifecycleService: QuotationLifecycleService,
  ) {}

  async apply(event: QuotationFinanceEvent) {
    if (event.eventType === 'PAYMENT_FAILED') {
      return this.quotationLifecycleService.markPaymentFailed(
        event.companyId,
        event.quotationId,
        {
          source: 'SYSTEM',
          changedByType: 'SYSTEM',
          requestId: event.invoiceId,
          reason: 'Payment failed from finance event',
          metadata: event as unknown as Record<string, unknown>,
        },
      );
    }

    if (event.eventType === 'PAYMENT_REFUNDED') {
      return this.quotationLifecycleService.markPaymentRefunded(
        event.companyId,
        event.quotationId,
        {
          source: 'SYSTEM',
          changedByType: 'SYSTEM',
          requestId: event.refundId ?? event.invoiceId,
          reason: 'Payment refunded from finance event',
          metadata: event as unknown as Record<string, unknown>,
        },
      );
    }

    const paidAmount = Number(event.totalAllocatedAmount ?? 0);
    if (paidAmount <= 0) {
      return this.quotationLifecycleService.markPaymentRequested(
        event.companyId,
        event.quotationId,
        {
          source: 'SYSTEM',
          changedByType: 'SYSTEM',
          requestId: event.invoiceId,
          reason: 'Payment reversed from finance event',
          metadata: event as unknown as Record<string, unknown>,
        },
      );
    }

    return paidAmount > 0 && event.eventType === 'PAYMENT_POSTED'
      ? this.quotationLifecycleService.markPartiallyPaid(
          event.companyId,
          event.quotationId,
          {
            source: 'SYSTEM',
            changedByType: 'SYSTEM',
            requestId: event.receiptId ?? event.invoiceId,
            paymentTransactionId: event.receiptId ?? undefined,
            reason: 'Partial payment posted from finance event',
            metadata: event as unknown as Record<string, unknown>,
          },
        )
      : null;
  }
}
