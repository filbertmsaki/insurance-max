import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  PaymentTransactionStatus,
  ReconciliationBatchStatus,
} from '@insurance-max/contracts';
import { ReconciliationService } from './reconciliation.service';
import { FinanceReconciliationBatch } from '../entities/finance-reconciliation-batch.entity';
import { FinanceReconciliationItem } from '../entities/finance-reconciliation-item.entity';
import { PaymentTransaction } from '../entities/payment-transaction.entity';
import { Receipt } from '../entities/receipt.entity';

describe('ReconciliationService safeguards', () => {
  const user = { id: 'user-1', companyId: 'company-1' } as any;
  const item = {
    id: 'item-1',
    company_id: user.companyId,
    batch_id: 'batch-1',
    amount: '125.0000',
    currency_code: 'TZS',
    status: 'UNMATCHED',
  };
  const batch = {
    id: item.batch_id,
    company_id: user.companyId,
    status: ReconciliationBatchStatus.IMPORTED,
  };
  const payment = {
    id: 'payment-1',
    company_id: user.companyId,
    status: PaymentTransactionStatus.SUCCESSFUL,
    amount: '125.0000',
    currency: 'TZS',
    reversed_at: null,
    deleted_at: null,
    reconciliation_status: 'UNMATCHED',
    receipt_id: null,
  };

  function createService(
    overrides: {
      item?: any;
      batch?: any;
      payment?: any;
      receipt?: any;
      existingMatch?: any;
    } = {},
  ) {
    const state = {
      item: { ...item, ...(overrides.item ?? {}) },
      batch: { ...batch, ...(overrides.batch ?? {}) },
      payment: { ...payment, ...(overrides.payment ?? {}) },
      receipt: overrides.receipt ?? null,
      existingMatch: overrides.existingMatch ?? null,
      savedItem: null as any,
      savedBatch: null as any,
    };
    const itemRepository = {
      createQueryBuilder: jest.fn(() => {
        const builder: any = {
          setLock: jest.fn(() => builder),
          where: jest.fn(() => builder),
          andWhere: jest.fn(() => builder),
          getOne: jest.fn(async () => state.item),
        };
        return builder;
      }),
      findOne: jest.fn(async (options: any) =>
        options?.where?.id === state.item.id ? state.item : state.existingMatch,
      ),
      find: jest.fn(async () => []),
      save: jest.fn(async (value) => {
        state.savedItem = value;
        return value;
      }),
    };
    const batchRepository = {
      findOne: jest.fn(async () => state.batch),
      findOneByOrFail: jest.fn(async () => state.batch),
      save: jest.fn(async (value) => {
        state.savedBatch = value;
        return value;
      }),
    };
    const paymentRepository = {
      findOne: jest.fn(async () => state.payment),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const receiptRepository = {
      findOne: jest.fn(async () => state.receipt),
    };
    const manager = {
      getRepository: jest.fn((entity) => {
        if (entity === FinanceReconciliationItem) return itemRepository;
        if (entity === FinanceReconciliationBatch) return batchRepository;
        if (entity === PaymentTransaction) return paymentRepository;
        if (entity === Receipt) return receiptRepository;
        throw new Error('Unexpected repository');
      }),
    };
    const dataSource = {
      transaction: jest.fn((callback) => callback(manager)),
    };
    const auditService = {
      logCritical: jest.fn().mockResolvedValue(undefined),
    };
    const service = new ReconciliationService(
      dataSource as any,
      { get: jest.fn() } as any,
      {} as any,
      {} as any,
      auditService as any,
    );
    return {
      service,
      state,
      itemRepository,
      batchRepository,
      paymentRepository,
      auditService,
    };
  }

  it('rejects a payment with a different amount or currency', async () => {
    const { service } = createService({ payment: { amount: '124.00' } });
    await expect(
      service.matchItem(user, item.id, { payment_transaction_id: payment.id }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects unsuccessful or reversed payment transactions', async () => {
    const { service } = createService({
      payment: { status: 'REVERSED', reversed_at: new Date() },
    });
    await expect(
      service.matchItem(user, item.id, { payment_transaction_id: payment.id }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a payment already matched to another statement line', async () => {
    const { service } = createService({
      existingMatch: {
        id: 'another-item',
        matched_payment_transaction_id: payment.id,
      },
    });
    await expect(
      service.matchItem(user, item.id, { payment_transaction_id: payment.id }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('does not allow matching an item from an approved batch', async () => {
    const { service, paymentRepository } = createService({
      batch: { status: ReconciliationBatchStatus.APPROVED },
    });
    await expect(
      service.matchItem(user, item.id, { payment_transaction_id: payment.id }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(paymentRepository.findOne).not.toHaveBeenCalled();
  });

  it('records an audit event when a valid manual match is saved', async () => {
    const { service, auditService, state } = createService();
    await expect(
      service.matchItem(user, item.id, { payment_transaction_id: payment.id }),
    ).resolves.toMatchObject({ status: 'MATCHED' });
    expect(state.savedItem.matched_payment_transaction_id).toBe(payment.id);
    expect(auditService.logCritical).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'finance.reconciliation.item_matched',
        companyId: user.companyId,
        resourceId: item.id,
      }),
      expect.any(Object),
    );
  });

  it('rejects approval when the current user matched a line in the batch', async () => {
    const manager = {
      getRepository: jest.fn((entity) => {
        if (entity === FinanceReconciliationBatch) {
          const builder: any = {
            setLock: jest.fn(() => builder),
            where: jest.fn(() => builder),
            andWhere: jest.fn(() => builder),
            getOne: jest.fn().mockResolvedValue({
              ...batch,
              status: ReconciliationBatchStatus.MATCHED,
              imported_by: 'different-user',
            }),
          };
          return { createQueryBuilder: () => builder };
        }
        if (entity === FinanceReconciliationItem) {
          return {
            find: jest
              .fn()
              .mockResolvedValue([
                { ...item, status: 'MATCHED', matched_by: user.id },
              ]),
          };
        }
        throw new Error('Unexpected repository');
      }),
    };
    const service = new ReconciliationService(
      { transaction: (callback) => callback(manager) } as any,
      {} as any,
      {} as any,
      {} as any,
      { logCritical: jest.fn() } as any,
    );

    await expect(
      service.approveBatch(user, batch.id, {} as any),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('releases a payment reconciliation marker when its item is excluded', async () => {
    const matchedItem = {
      ...item,
      status: 'MATCHED',
      matched_payment_transaction_id: payment.id,
      matched_receipt_id: null,
    };
    const { service, paymentRepository } = createService({ item: matchedItem });
    await service.excludeItem(user, item.id, {
      reason: 'Statement correction',
    });
    expect(paymentRepository.update).toHaveBeenCalledWith(
      { id: payment.id, company_id: user.companyId },
      { reconciliation_status: 'UNMATCHED' },
    );
  });

  it('maps database uniqueness races to a reconciliation conflict', () => {
    const { service } = createService();

    expect(() =>
      (service as any).throwMatchConflict({
        driverError: {
          code: '23505',
          constraint: 'UQ_reconciliation_matched_payment_active',
        },
      }),
    ).toThrow(ConflictException);
  });

  it('excludes duplicate statement rows from opening-to-closing movement', () => {
    const { service } = createService();
    const movement = (service as any).calculateStatementTotal([
      { amount: '125.0000', status: 'UNMATCHED' },
      { amount: '125.0000', status: 'DUPLICATE' },
      { amount: '-5.0000', status: 'UNMATCHED' },
    ]);

    expect(movement.toFixed(4)).toBe('120.0000');
  });
});
