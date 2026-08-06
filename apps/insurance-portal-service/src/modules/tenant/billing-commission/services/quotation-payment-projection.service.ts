import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';

import {
  InvoiceSourceType,
  InvoiceStatus,
  QuotationFinanceEvent,
} from '@insurance-max/contracts';
import { FinanceOutboxService } from './finance-outbox.service';
import { CommissionAccrualService } from './commission-accrual.service';
import { Invoice } from '../entities/invoice.entity';
import { QuotationLifecycleService } from '../../quotations/services/quotation-lifecycle.service';

@Injectable()
export class QuotationPaymentProjectionService {
  constructor(
    private readonly outboxService: FinanceOutboxService,
    private readonly quotationLifecycleService: QuotationLifecycleService,
    private readonly commissionAccrualService: CommissionAccrualService,
  ) {}

  async publishInvoiceBalance(
    manager: EntityManager,
    invoiceId: string,
    sourceEventId: string,
  ) {
    const invoice = await manager.getRepository(Invoice).findOneOrFail({
      where: { id: invoiceId },
    });

    if (
      invoice.source_type !== InvoiceSourceType.QUOTATION ||
      !invoice.source_record_id ||
      !invoice.source_revision
    ) {
      return;
    }

    let eventType: QuotationFinanceEvent['eventType'];
    switch (invoice.status) {
      case InvoiceStatus.PAID:
      case InvoiceStatus.OVERPAID:
      case InvoiceStatus.PARTIALLY_PAID:
        eventType = 'PAYMENT_POSTED';
        break;
      default:
        eventType = 'PAYMENT_REVERSED';
        break;
    }

    const payload: QuotationFinanceEvent = {
      eventId: `invoice-balance:${invoice.id}:${invoice.balance_revision}:${sourceEventId}`,
      companyId: invoice.company_id,
      quotationId: invoice.source_record_id,
      workflowRevision: invoice.source_revision,
      invoiceId: invoice.id,
      eventType,
      allocatedAmount: invoice.allocated_amount ?? '0.0000',
      totalAllocatedAmount: invoice.paid_amount ?? '0.0000',
      currencyCode: invoice.currency,
      receiptId: null,
      refundId: null,
      occurredAt: new Date().toISOString(),
    };

    await this.outboxService.add(manager, {
      companyId: invoice.company_id,
      aggregateType: 'INVOICE',
      aggregateId: invoice.id,
      eventType: 'QUOTATION_PAYMENT_EVENT',
      eventKey: payload.eventId,
      payload: payload as unknown as Record<string, unknown>,
    });

    if (
      invoice.status === InvoiceStatus.PAID ||
      invoice.status === InvoiceStatus.OVERPAID
    ) {
      await this.quotationLifecycleService.markPaymentPaid(
        invoice.company_id,
        invoice.source_record_id,
        {
          source: 'SYSTEM',
          changedByType: 'SYSTEM',
          requestId: invoice.id,
          reason: 'Finance allocation completed invoice payment',
          metadata: payload as unknown as Record<string, unknown>,
        },
      );

      await this.commissionAccrualService.accrueForPaidQuotation(
        manager,
        invoice.source_record_id,
        invoice.source_revision,
        payload.eventId,
        invoice.id,
      );
    } else if (invoice.status === InvoiceStatus.PARTIALLY_PAID) {
      await this.quotationLifecycleService.markPartiallyPaid(
        invoice.company_id,
        invoice.source_record_id,
        {
          source: 'SYSTEM',
          changedByType: 'SYSTEM',
          requestId: invoice.id,
          reason: 'Finance allocation partially settled invoice payment',
          metadata: payload as unknown as Record<string, unknown>,
        },
      );
    } else {
      await this.quotationLifecycleService.markPaymentRequested(
        invoice.company_id,
        invoice.source_record_id,
        {
          source: 'SYSTEM',
          changedByType: 'SYSTEM',
          requestId: invoice.id,
          reason: 'Finance reversal removed settled payment state',
          metadata: payload as unknown as Record<string, unknown>,
        },
      );
    }
  }
}
