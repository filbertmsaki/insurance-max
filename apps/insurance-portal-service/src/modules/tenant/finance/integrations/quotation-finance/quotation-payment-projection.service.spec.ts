import { InvoiceSourceType, InvoiceStatus } from '@insurance-max/contracts';
import { QuotationPaymentProjectionService } from './quotation-payment-projection.service';

describe('quotation finance projection transaction', () => {
  it.each([
    [InvoiceStatus.PAID, 'markPaymentPaid'],
    [InvoiceStatus.PARTIALLY_PAID, 'markPartiallyPaid'],
    [InvoiceStatus.ISSUED, 'markPaymentRequested'],
  ])(
    'uses the finance manager for %s and writes the outbox in the same transaction',
    async (status, method) => {
      const invoice = {
        id: 'invoice',
        company_id: 'company',
        source_type: InvoiceSourceType.QUOTATION,
        source_record_id: 'quotation',
        source_revision: 1,
        status,
        balance_revision: 1,
        allocated_amount: '10',
        paid_amount: '10',
        currency: 'TZS',
      };
      const manager = {
        getRepository: jest.fn().mockReturnValue({
          findOneOrFail: jest.fn().mockResolvedValue(invoice),
        }),
      };
      const lifecycle = {
        markPaymentPaid: jest.fn(),
        markPartiallyPaid: jest.fn(),
        markPaymentRequested: jest.fn(),
      };
      const outbox = { add: jest.fn() };
      const commission = { accrueForPaidQuotation: jest.fn() };
      const service = new QuotationPaymentProjectionService(
        outbox,
        lifecycle as any,
        commission as any,
      );
      await service.publishInvoiceBalance(manager as any, 'invoice', 'source');
      expect(outbox.add).toHaveBeenCalledWith(manager, expect.any(Object));
      expect(lifecycle[method]).toHaveBeenCalledWith(
        'company',
        'quotation',
        expect.any(Object),
        manager,
      );
      if (status === InvoiceStatus.PAID)
        expect(commission.accrueForPaidQuotation).toHaveBeenCalledWith(
          manager,
          'quotation',
          1,
          expect.any(String),
          'invoice',
        );
    },
  );
});
