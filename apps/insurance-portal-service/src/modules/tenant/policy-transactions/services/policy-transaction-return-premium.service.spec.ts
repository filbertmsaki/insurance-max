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
});
