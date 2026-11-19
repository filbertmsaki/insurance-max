import { ConflictException } from '@nestjs/common';
import { PaymentTransactionStatus } from '@insurance-max/contracts';
import { Invoice } from '../invoices/entities/invoice.entity';
import { Receipt } from './entities/receipt.entity';
import { FinanceAutoReceiptService } from './finance-auto-receipt.service';

describe('FinanceAutoReceiptService company boundary', () => {
  it('holds a payment whose referenced invoice is absent in its company', async () => {
    const invoices = { findOne: jest.fn().mockResolvedValue(null) };
    const receipts = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn(),
    };
    const manager = {
      getRepository: jest.fn((entity) =>
        entity === Invoice
          ? invoices
          : entity === Receipt
            ? receipts
            : undefined,
      ),
    };
    const config = { get: jest.fn().mockReturnValue(true) };
    const service = new FinanceAutoReceiptService(
      config as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await expect(
      service.postWhenEligible(
        manager as never,
        {
          id: 'payment-1',
          company_id: 'company-a',
          invoice_id: 'invoice-b',
          status: PaymentTransactionStatus.SUCCESSFUL,
        } as never,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(invoices.findOne).toHaveBeenCalledWith({
      where: { id: 'invoice-b', company_id: 'company-a' },
    });
    expect(receipts.save).not.toHaveBeenCalled();
  });
});
