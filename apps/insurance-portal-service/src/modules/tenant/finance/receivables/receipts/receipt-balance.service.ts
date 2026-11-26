import { ConflictException, Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';

import { ReceiptStatus } from '@insurance-max/contracts';
import { ReceiptAllocation } from '../receipt-allocations/entities/receipt-allocation.entity';
import { Receipt } from './entities/receipt.entity';
import { ReceiptAllocationStatus } from '../../common/enums/finance-status.enums';
import { financialDecimal } from '../../foundation/currencies/finance-currency-controls';

import { DecimalUtil } from '../../../../shared/finance/decimal.util';

@Injectable()
export class ReceiptBalanceService {
  async recalculate(manager: EntityManager, receiptId: string) {
    const receipt = await manager
      .getRepository(Receipt)
      .createQueryBuilder('receipt')
      .setLock('pessimistic_write')
      .where('receipt.id = :receiptId', { receiptId })
      .getOneOrFail();

    const allocationResult = await manager
      .getRepository(ReceiptAllocation)
      .createQueryBuilder('allocation')
      .select(`COALESCE(SUM(allocation.amount), 0)`, 'amount')
      .where('allocation.receipt_id = :receiptId', { receiptId })
      .andWhere('allocation.status = :status', {
        status: ReceiptAllocationStatus.ACTIVE,
      })
      .getRawOne<{ amount: string }>();

    const allocated = financialDecimal(allocationResult?.amount as string);
    const [refund] = manager.query
      ? await manager.query(
          "SELECT to_jsonb(r)->>'ar_cash_refunded' amount FROM receipts r WHERE id=$1",
          [receipt.id],
        )
      : [];
    const amount = financialDecimal(receipt.amount).minus(
      financialDecimal(refund?.amount ?? '0'),
    );
    if (
      [amount, allocated].some(
        (value) => !value.isFinite() || value.isNegative(),
      ) ||
      allocated.greaterThan(amount)
    )
      throw new ConflictException({
        code: 'FINANCE_BALANCE_RECONCILIATION_REQUIRED',
        message:
          'Receipt allocations exceed confirmed cash or contain an invalid amount. Reconcile the source records before changing the balance.',
      });
    const unallocated = amount.minus(allocated);

    receipt.allocated_amount = DecimalUtil.exactMoney(allocated);
    receipt.unallocated_amount = DecimalUtil.exactMoney(unallocated);

    if (
      receipt.status !== ReceiptStatus.REVERSED &&
      receipt.status !== ReceiptStatus.VOIDED
    ) {
      if (allocated.equals(0)) {
        receipt.status = ReceiptStatus.POSTED;
      } else if (unallocated.equals(0)) {
        receipt.status = ReceiptStatus.FULLY_ALLOCATED;
      } else {
        receipt.status = ReceiptStatus.PARTIALLY_ALLOCATED;
      }
    }

    return manager.getRepository(Receipt).save(receipt);
  }
}
