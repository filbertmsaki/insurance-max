import { ReceiptStatus } from '@insurance-max/contracts';
import { ReceiptAllocation } from '../entities/receipt-allocation.entity';
import { Receipt } from '../entities/receipt.entity';
import { ReceiptAllocationStatus } from '../enums/finance-status.enums';
import { ReceiptBalanceService } from './receipt-balance.service';

function queryBuilderReturning<T>(value: T) {
  return {
    setLock: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    getOneOrFail: jest.fn().mockResolvedValue(value),
    getRawOne: jest.fn().mockResolvedValue(value),
  };
}

describe('ReceiptBalanceService', () => {
  const service = new ReceiptBalanceService();

  it('marks a receipt fully allocated when active allocations consume the amount', async () => {
    const receipt = {
      id: 'receipt-1',
      amount: '100.0000',
      status: ReceiptStatus.POSTED,
    } as Receipt;
    const receiptQb = queryBuilderReturning(receipt);
    const allocationQb = queryBuilderReturning({ amount: '100.0000' });
    const save = jest.fn(async (entity) => entity);
    const manager = {
      getRepository: jest.fn((entity) => {
        if (entity === Receipt)
          return { createQueryBuilder: () => receiptQb, save };
        if (entity === ReceiptAllocation)
          return { createQueryBuilder: () => allocationQb };
        throw new Error('Unexpected repository');
      }),
    };

    const result = await service.recalculate(manager as never, receipt.id);

    expect(allocationQb.andWhere).toHaveBeenCalledWith(
      'allocation.status = :status',
      { status: ReceiptAllocationStatus.ACTIVE },
    );
    expect(result.allocated_amount).toBe('100.0000');
    expect(result.unallocated_amount).toBe('0.0000');
    expect(result.status).toBe(ReceiptStatus.FULLY_ALLOCATED);
  });

  it('does not reopen reversed receipts during balance recalculation', async () => {
    const receipt = {
      id: 'receipt-2',
      amount: '100.0000',
      status: ReceiptStatus.REVERSED,
    } as Receipt;
    const receiptQb = queryBuilderReturning(receipt);
    const allocationQb = queryBuilderReturning({ amount: '25.0000' });
    const save = jest.fn(async (entity) => entity);
    const manager = {
      getRepository: jest.fn((entity) => {
        if (entity === Receipt)
          return { createQueryBuilder: () => receiptQb, save };
        if (entity === ReceiptAllocation)
          return { createQueryBuilder: () => allocationQb };
        throw new Error('Unexpected repository');
      }),
    };

    const result = await service.recalculate(manager as never, receipt.id);

    expect(result.allocated_amount).toBe('25.0000');
    expect(result.unallocated_amount).toBe('75.0000');
    expect(result.status).toBe(ReceiptStatus.REVERSED);
  });
});
