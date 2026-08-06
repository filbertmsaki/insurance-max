import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';

import { DecimalUtil } from '../../../shared/finance/decimal.util';
import { ReceiptStatus } from '@insurance-max/contracts';
import { ReceiptAllocation } from '../entities/receipt-allocation.entity';
import { Receipt } from '../entities/receipt.entity';
import { ReceiptAllocationStatus } from '../enums/finance-status.enums';

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

    const allocated = DecimalUtil.value(allocationResult?.amount ?? 0);
    const amount = DecimalUtil.value(receipt.amount);
    const unallocated = amount.minus(allocated).greaterThan(0)
      ? amount.minus(allocated)
      : DecimalUtil.value(0);

    receipt.allocated_amount = allocated.toFixed(4);
    receipt.unallocated_amount = unallocated.toFixed(4);

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
