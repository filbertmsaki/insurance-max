import { ConflictException, Injectable } from '@nestjs/common';
import { ProductDefinitionHashService } from '@insurance-max/shared-kernel';
import { EntityManager } from 'typeorm';

import { DecimalUtil } from '../../../../shared/finance/decimal.util';
import { FinanceRefund } from '../refunds/entities/finance-refund.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { ReceiptAllocation } from '../receipt-allocations/entities/receipt-allocation.entity';
import { InvoiceStatus, RefundStatus } from '@insurance-max/contracts';
import { ReceiptAllocationStatus } from '../../common/enums/finance-status.enums';
import { financialDecimal } from '../../foundation/currencies/finance-currency-controls';

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

    const allocated = financialDecimal(allocationResult?.amount as string);
    const refunded = financialDecimal(refundResult?.amount as string);
    const writtenOff = financialDecimal(invoice.written_off_amount);
    const total = financialDecimal(invoice.total_amount);
    // A genuine customer credit is distinct from an inconsistent cash history.
    // Never hide an over-refund or invalid aggregate by clamping it to zero.
    if (
      [allocated, refunded, writtenOff, total].some(
        (amount) => !amount.isFinite() || amount.isNegative(),
      ) ||
      refunded.greaterThan(allocated) ||
      writtenOff.greaterThan(total)
    )
      throw new ConflictException({
        code: 'FINANCE_BALANCE_RECONCILIATION_REQUIRED',
        message:
          'Invoice amounts contain an invalid aggregate or a paid refund exceeds allocated collections. Reconcile the source records before changing the balance.',
      });
    const effectivePaid = allocated.minus(refunded);
    const balance = total.minus(effectivePaid).minus(writtenOff).greaterThan(0)
      ? total.minus(effectivePaid).minus(writtenOff)
      : DecimalUtil.value(0);

    invoice.allocated_amount = DecimalUtil.exactMoney(allocated);
    invoice.paid_amount = DecimalUtil.exactMoney(effectivePaid);
    invoice.refunded_amount = DecimalUtil.exactMoney(refunded);
    invoice.balance_amount = DecimalUtil.exactMoney(balance);

    if (invoice.status === InvoiceStatus.VOIDED) {
      // Recalculation cannot silently reopen a legally voided document.
    } else if (
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
