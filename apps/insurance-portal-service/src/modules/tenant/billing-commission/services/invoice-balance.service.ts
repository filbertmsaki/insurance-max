import { Injectable } from '@nestjs/common';
import { ProductDefinitionHashService } from '@insurance-max/shared-kernel';
import { EntityManager } from 'typeorm';

import { DecimalUtil } from '../../../shared/finance/decimal.util';
import { FinanceRefund } from '../entities/finance-refund.entity';
import { Invoice } from '../entities/invoice.entity';
import { ReceiptAllocation } from '../entities/receipt-allocation.entity';
import { InvoiceStatus, RefundStatus } from '@insurance-max/contracts';
import { ReceiptAllocationStatus } from '../enums/finance-status.enums';

@Injectable()
export class InvoiceBalanceService {
  constructor(private readonly hashService: ProductDefinitionHashService) {}

  async recalculate(manager: EntityManager, invoiceId: string) {
    const invoice = await manager
      .getRepository(Invoice)
      .createQueryBuilder('invoice')
      .setLock('pessimistic_write')
      .where('invoice.id = :invoiceId', { invoiceId })
      .getOneOrFail();

    const allocationResult = await manager
      .getRepository(ReceiptAllocation)
      .createQueryBuilder('allocation')
      .select(`COALESCE(SUM(allocation.amount), 0)`, 'amount')
      .where('allocation.invoice_id = :invoiceId', { invoiceId })
      .andWhere('allocation.status = :status', {
        status: ReceiptAllocationStatus.ACTIVE,
      })
      .getRawOne<{ amount: string }>();

    const refundResult = await manager
      .getRepository(FinanceRefund)
      .createQueryBuilder('refund')
      .select(`COALESCE(SUM(refund.amount), 0)`, 'amount')
      .where('refund.invoice_id = :invoiceId', { invoiceId })
      .andWhere('refund.status = :status', { status: RefundStatus.PAID })
      .getRawOne<{ amount: string }>();

    const allocated = DecimalUtil.value(allocationResult?.amount ?? 0);
    const refunded = DecimalUtil.value(refundResult?.amount ?? 0);
    const writtenOff = DecimalUtil.value(invoice.written_off_amount ?? 0);
    const total = DecimalUtil.value(invoice.total_amount);
    const effectivePaid = allocated.minus(refunded).greaterThan(0)
      ? allocated.minus(refunded)
      : DecimalUtil.value(0);
    const balance = total.minus(effectivePaid).minus(writtenOff).greaterThan(0)
      ? total.minus(effectivePaid).minus(writtenOff)
      : DecimalUtil.value(0);

    invoice.allocated_amount = allocated.toFixed(4);
    invoice.paid_amount = effectivePaid.toFixed(4);
    invoice.refunded_amount = refunded.toFixed(4);
    invoice.balance_amount = balance.toFixed(4);

    if (
      balance.equals(0) &&
      effectivePaid.greaterThanOrEqualTo(total.minus(writtenOff))
    ) {
      invoice.status = effectivePaid.greaterThan(total)
        ? InvoiceStatus.OVERPAID
        : InvoiceStatus.PAID;
    } else if (effectivePaid.greaterThan(0)) {
      invoice.status = InvoiceStatus.PARTIALLY_PAID;
    } else if (invoice.status !== InvoiceStatus.VOIDED) {
      invoice.status = InvoiceStatus.ISSUED;
    }

    invoice.balance_revision = Number(invoice.balance_revision ?? 0) + 1;
    invoice.balance_hash = this.calculateHash(invoice);

    return manager.getRepository(Invoice).save(invoice);
  }

  calculateHash(invoice: Invoice) {
    return this.hashService.hashDefinition({
      invoiceId: invoice.id,
      totalAmount: invoice.total_amount,
      allocatedAmount: invoice.allocated_amount,
      refundedAmount: invoice.refunded_amount,
      writtenOffAmount: invoice.written_off_amount,
      balanceAmount: invoice.balance_amount,
      currencyCode: invoice.currency,
      revision: invoice.balance_revision,
    });
  }
}
