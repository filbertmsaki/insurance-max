import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { InvoiceSourceType, InvoiceStatus } from '@insurance-max/contracts';

import { Invoice } from '../entities/invoice.entity';
import { PolicyTransactionLifecycleService } from '../../policy-transactions/services/policy-transaction-lifecycle.service';

@Injectable()
export class PolicyTransactionPaymentProjectionService {
  constructor(
    private readonly lifecycleService: PolicyTransactionLifecycleService,
  ) {}

  async publishInvoiceBalance(
    manager: EntityManager,
    invoiceId: string,
    sourceEventId: string,
  ) {
    const invoice = await manager.getRepository(Invoice).findOneOrFail({
      where: {
        id: invoiceId,
      },
    });

    if (
      !(
        invoice.source_type === InvoiceSourceType.ENDORSEMENT ||
        invoice.source_type === InvoiceSourceType.CANCELLATION
      ) ||
      !invoice.source_record_id
    ) {
      return;
    }

    const context = {
      changedBy: null,
      changedByType: 'SYSTEM',
      requestId: invoice.id,
      reason: `Finance invoice ${invoice.invoice_no} balance changed`,
      metadata: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoice_no,
        invoiceStatus: invoice.status,
        sourceEventId,
        paidAmount: invoice.paid_amount,
        allocatedAmount: invoice.allocated_amount,
        balanceAmount: invoice.balance_amount,
      },
    };

    if (
      invoice.status === InvoiceStatus.PAID ||
      invoice.status === InvoiceStatus.OVERPAID
    ) {
      await this.lifecycleService.markPaymentPaid(
        invoice.company_id,
        invoice.source_record_id,
        {
          ...context,
          reason:
            'Finance allocation fully settled endorsement additional premium',
        },
      );

      return;
    }

    if (invoice.status === InvoiceStatus.PARTIALLY_PAID) {
      await this.lifecycleService.markPaymentPartial(
        invoice.company_id,
        invoice.source_record_id,
        {
          ...context,
          reason:
            'Finance allocation partially settled endorsement additional premium',
        },
      );

      return;
    }

    await this.lifecycleService.markPaymentRequested(
      invoice.company_id,
      invoice.source_record_id,
      {
        ...context,
        reason: 'Endorsement invoice is awaiting settlement',
      },
    );
  }
}
