import { ProductDefinitionHashService } from '@insurance-max/shared-kernel';
import { InvoiceStatus, RefundStatus } from '@insurance-max/contracts';
import { FinanceRefund } from '../entities/finance-refund.entity';
import { Invoice } from '../entities/invoice.entity';
import { ReceiptAllocation } from '../entities/receipt-allocation.entity';
import { ReceiptAllocationStatus } from '../enums/finance-status.enums';
import { InvoiceBalanceService } from './invoice-balance.service';

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

describe('InvoiceBalanceService', () => {
  const service = new InvoiceBalanceService(new ProductDefinitionHashService());

  it('subtracts paid refunds from allocations before calculating invoice status', async () => {
    const invoice = {
      id: 'invoice-1',
      total_amount: '100.0000',
      written_off_amount: '10.0000',
      currency: 'TZS',
      status: InvoiceStatus.ISSUED,
      balance_revision: 3,
    } as Invoice;
    const invoiceQb = queryBuilderReturning(invoice);
    const allocationQb = queryBuilderReturning({ amount: '75.0000' });
    const refundQb = queryBuilderReturning({ amount: '20.0000' });
    const save = jest.fn(async (entity) => entity);
    const manager = {
      getRepository: jest.fn((entity) => {
        if (entity === Invoice) {
          return { createQueryBuilder: () => invoiceQb, save };
        }
        if (entity === ReceiptAllocation) {
          return { createQueryBuilder: () => allocationQb };
        }
        if (entity === FinanceRefund) {
          return { createQueryBuilder: () => refundQb };
        }
        throw new Error('Unexpected repository');
      }),
    };

    const result = await service.recalculate(manager as never, invoice.id);

    expect(allocationQb.andWhere).toHaveBeenCalledWith(
      'allocation.status = :status',
      { status: ReceiptAllocationStatus.ACTIVE },
    );
    expect(refundQb.andWhere).toHaveBeenCalledWith('refund.status = :status', {
      status: RefundStatus.PAID,
    });
    expect(result.allocated_amount).toBe('75.0000');
    expect(result.refunded_amount).toBe('20.0000');
    expect(result.paid_amount).toBe('55.0000');
    expect(result.balance_amount).toBe('35.0000');
    expect(result.status).toBe(InvoiceStatus.PARTIALLY_PAID);
    expect(result.balance_revision).toBe(4);
    expect(result.balance_hash).toBe(service.calculateHash(result));
  });

  it('never lets refunds drive effective paid or balance below zero', async () => {
    const invoice = {
      id: 'invoice-2',
      total_amount: '50.0000',
      written_off_amount: '60.0000',
      currency: 'TZS',
      status: InvoiceStatus.ISSUED,
      balance_revision: 0,
    } as Invoice;
    const invoiceQb = queryBuilderReturning(invoice);
    const allocationQb = queryBuilderReturning({ amount: '10.0000' });
    const refundQb = queryBuilderReturning({ amount: '30.0000' });
    const save = jest.fn(async (entity) => entity);
    const manager = {
      getRepository: jest.fn((entity) => {
        if (entity === Invoice)
          return { createQueryBuilder: () => invoiceQb, save };
        if (entity === ReceiptAllocation)
          return { createQueryBuilder: () => allocationQb };
        if (entity === FinanceRefund)
          return { createQueryBuilder: () => refundQb };
        throw new Error('Unexpected repository');
      }),
    };

    const result = await service.recalculate(manager as never, invoice.id);

    expect(result.paid_amount).toBe('0.0000');
    expect(result.balance_amount).toBe('0.0000');
    expect(result.status).toBe(InvoiceStatus.PAID);
  });
});
