import { InvoiceStatus, QuotationFinanceEvent } from '@insurance-max/contracts';

import { QuotationPaymentEventService } from './quotation-payment-event.service';

describe('QuotationPaymentEventService', () => {
  const lifecycle = {
    markPaymentPaid: jest.fn(),
    markPartiallyPaid: jest.fn(),
    markPaymentRequested: jest.fn(),
    markPaymentFailed: jest.fn(),
    markPaymentRefunded: jest.fn(),
  };
  const invoiceRepository = { findOne: jest.fn() };
  const service = new QuotationPaymentEventService(
    lifecycle as never,
    invoiceRepository as never,
  );

  const event = (
    overrides: Partial<QuotationFinanceEvent> = {},
  ): QuotationFinanceEvent => ({
    eventId: 'invoice-balance:inv-1:2:src',
    companyId: 'co-1',
    quotationId: 'q-1',
    workflowRevision: 3,
    invoiceId: 'inv-1',
    eventType: 'PAYMENT_POSTED',
    allocatedAmount: '100.0000',
    totalAllocatedAmount: '100.0000',
    currencyCode: 'TZS',
    receiptId: null,
    refundId: null,
    occurredAt: new Date().toISOString(),
    ...overrides,
  });

  beforeEach(() => jest.clearAllMocks());

  it('keeps a fully paid quotation PAID when the posted event is replayed', async () => {
    invoiceRepository.findOne.mockResolvedValue({
      id: 'inv-1',
      status: InvoiceStatus.PAID,
      source_revision: 3,
    });

    await service.apply(event());

    expect(lifecycle.markPaymentPaid).toHaveBeenCalledWith(
      'co-1',
      'q-1',
      expect.objectContaining({ requestId: 'inv-1' }),
    );
    expect(lifecycle.markPartiallyPaid).not.toHaveBeenCalled();
  });

  it('uses the live invoice status, not the queued amounts', async () => {
    // Event captured a partial payment; the invoice has since been settled.
    invoiceRepository.findOne.mockResolvedValue({
      id: 'inv-1',
      status: InvoiceStatus.PAID,
      source_revision: 3,
    });

    await service.apply(event({ totalAllocatedAmount: '40.0000' }));

    expect(lifecycle.markPaymentPaid).toHaveBeenCalled();
    expect(lifecycle.markPartiallyPaid).not.toHaveBeenCalled();
  });

  it('marks partially paid when the invoice is partially paid', async () => {
    invoiceRepository.findOne.mockResolvedValue({
      id: 'inv-1',
      status: InvoiceStatus.PARTIALLY_PAID,
      source_revision: 3,
    });

    await service.apply(event({ receiptId: 'rcpt-1' }));

    expect(lifecycle.markPartiallyPaid).toHaveBeenCalledWith(
      'co-1',
      'q-1',
      expect.objectContaining({ paymentTransactionId: 'rcpt-1' }),
    );
  });

  it('moves back to requested when a reversal leaves the invoice open', async () => {
    invoiceRepository.findOne.mockResolvedValue({
      id: 'inv-1',
      status: InvoiceStatus.ISSUED,
      source_revision: 3,
    });

    await service.apply(event({ eventType: 'PAYMENT_REVERSED' }));

    expect(lifecycle.markPaymentRequested).toHaveBeenCalled();
  });

  it('skips events for a superseded workflow revision', async () => {
    invoiceRepository.findOne.mockResolvedValue({
      id: 'inv-1',
      status: InvoiceStatus.ISSUED,
      source_revision: 4,
    });

    await expect(service.apply(event())).resolves.toBeNull();
    expect(lifecycle.markPaymentRequested).not.toHaveBeenCalled();
  });

  it('skips events whose invoice no longer exists', async () => {
    invoiceRepository.findOne.mockResolvedValue(null);

    await expect(service.apply(event())).resolves.toBeNull();
  });

  it('still applies failed and refunded events directly', async () => {
    await service.apply(event({ eventType: 'PAYMENT_FAILED' }));
    await service.apply(
      event({ eventType: 'PAYMENT_REFUNDED', refundId: 'rf-1' }),
    );

    expect(lifecycle.markPaymentFailed).toHaveBeenCalled();
    expect(lifecycle.markPaymentRefunded).toHaveBeenCalledWith(
      'co-1',
      'q-1',
      expect.objectContaining({ requestId: 'rf-1' }),
    );
    expect(invoiceRepository.findOne).not.toHaveBeenCalled();
  });
});
