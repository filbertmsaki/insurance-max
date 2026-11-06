import {
  InvoiceSourceType,
  PolicyTransactionStage,
  RefundStatus,
} from '@insurance-max/contracts';
import { ProductDefinitionHashService } from '@insurance-max/shared-kernel';

import { PolicyTransactionReturnPremiumService } from './policy-transaction-return-premium.service';

describe('PolicyTransactionReturnPremiumService', () => {
  it('records an unfunded return premium for reconciliation after an accepted cancellation', async () => {
    const savedRefunds: Array<Record<string, unknown>> = [];
    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    const manager = {
      getRepository: (entity: { name: string }) => {
        if (entity.name === 'FinanceRefund') {
          return {
            find: jest.fn().mockResolvedValue([]),
            save: jest.fn().mockImplementation(async (value) => {
              const saved = { ...value, id: 'refund-1' };
              savedRefunds.push(saved);
              return saved;
            }),
          };
        }
        if (entity.name === 'Invoice') {
          return { createQueryBuilder: () => queryBuilder };
        }
        return { save: jest.fn().mockResolvedValue(undefined) };
      },
    };
    const service = new PolicyTransactionReturnPremiumService(
      { generateRefundNumber: jest.fn().mockResolvedValue('REF-1') } as any,
      new ProductDefinitionHashService(),
    );

    const refunds = await service.createRequests(
      manager as any,
      {
        id: 'transaction-1',
        company_id: 'company-1',
        transaction_no: 'CXL-1',
        stage: PolicyTransactionStage.APPLIED,
        premium_effect: 'CREDIT',
        return_premium: '411871.5847',
        currency_code: 'TZS',
        requested_by: 'user-1',
      } as any,
      {
        id: 'policy-1',
        company_id: 'company-1',
        customer_id: 'customer-1',
        quotation_id: 'quotation-1',
      } as any,
      'cancellation-1',
      InvoiceSourceType.CANCELLATION,
    );

    expect(refunds).toHaveLength(1);
    expect(savedRefunds[0]).toMatchObject({
      status: RefundStatus.FAILED,
      amount: '411871.5847',
      receipt_id: null,
      invoice_id: null,
      source_record_id: 'transaction-1',
    });
  });
  it('groups allocations per receipt and invoice, subtracts reservations once and records unfunded remainder', async () => {
    const saved: any[] = [];
    const receipt = {
      currency: 'TZS',
      payer_customer_id: 'customer-1',
      payment_method: 'CASH',
    };
    const allocations = [
      {
        receipt_id: 'receipt-1',
        invoice_id: 'invoice-1',
        amount: '30',
        currency: 'TZS',
        receipt,
      },
      {
        receipt_id: 'receipt-1',
        invoice_id: 'invoice-1',
        amount: '40',
        currency: 'TZS',
        receipt,
      },
      {
        receipt_id: 'receipt-2',
        invoice_id: 'invoice-2',
        amount: '100',
        currency: 'USD',
        receipt: { ...receipt, currency: 'USD' },
      },
    ];
    const builder = (values: any[]) => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(values),
      getRawOne: jest.fn().mockResolvedValue({ amount: '10' }),
    });
    const manager = {
      getRepository: (entity: { name: string }) => {
        if (entity.name === 'Invoice')
          return {
            createQueryBuilder: () =>
              builder([{ id: 'invoice-1' }, { id: 'invoice-2' }]),
          };
        if (entity.name === 'ReceiptAllocation')
          return { createQueryBuilder: () => builder(allocations) };
        if (entity.name === 'FinanceRefund')
          return {
            find: jest.fn().mockResolvedValue([]),
            createQueryBuilder: () => builder([]),
            save: jest.fn(async (value) => {
              const row = { ...value, id: 'refund-' + (saved.length + 1) };
              saved.push(row);
              return row;
            }),
          };
        return { save: jest.fn().mockResolvedValue(undefined) };
      },
    };
    const service = new PolicyTransactionReturnPremiumService(
      { generateRefundNumber: jest.fn().mockResolvedValue('REF') } as any,
      new ProductDefinitionHashService(),
    );
    await service.createRequests(
      manager as any,
      {
        id: 'transaction-1',
        company_id: 'company-1',
        transaction_no: 'CXL-1',
        stage: PolicyTransactionStage.APPLIED,
        premium_effect: 'CREDIT',
        return_premium: '100',
        currency_code: 'TZS',
        requested_by: 'user-1',
      } as any,
      {
        id: 'policy-1',
        customer_id: 'customer-1',
        quotation_id: 'quotation-1',
      } as any,
      'cancellation-1',
      InvoiceSourceType.CANCELLATION,
    );
    expect(saved).toHaveLength(2);
    expect(saved[0]).toMatchObject({
      receipt_id: 'receipt-1',
      invoice_id: 'invoice-1',
      amount: '60.0000',
      status: RefundStatus.REQUESTED,
    });
    expect(saved[1]).toMatchObject({
      receipt_id: null,
      amount: '40.0000',
      status: RefundStatus.FAILED,
    });
  });
});
