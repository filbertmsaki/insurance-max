import { InvoiceSourceType, InvoiceStatus } from '@insurance-max/contracts';
import { PolicyTransactionPaymentProjectionService } from './policy-transaction-payment-projection.service';

describe('policy transaction finance projection', () => {
  it.each([
    [InvoiceStatus.PAID, 'markPaymentPaid'],
    [InvoiceStatus.PARTIALLY_PAID, 'markPaymentPartial'],
    [InvoiceStatus.ISSUED, 'markPaymentRequested'],
  ])('uses the finance transaction for %s', async (status, method) => {
    const invoice = {
      id: 'invoice',
      company_id: 'company',
      source_type: InvoiceSourceType.ENDORSEMENT,
      source_record_id: 'transaction',
      status,
    };
    const manager = {
      getRepository: jest.fn().mockReturnValue({
        findOneOrFail: jest.fn().mockResolvedValue(invoice),
      }),
    };
    const lifecycle = {
      markPaymentPaid: jest.fn(),
      markPaymentPartial: jest.fn(),
      markPaymentRequested: jest.fn(),
    };
    const service = new PolicyTransactionPaymentProjectionService(
      lifecycle as any,
    );
    await service.publishInvoiceBalance(manager as any, 'invoice', 'event');
    expect(lifecycle[method]).toHaveBeenCalledWith(
      'company',
      'transaction',
      expect.any(Object),
      manager,
    );
  });
});
