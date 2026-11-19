import {
  CommissionPaymentStatus,
  RefundStatus,
} from '@insurance-max/contracts';
import { FinanceCommandService } from './finance-command.service';

describe('Legacy payout settlement safety', () => {
  const buildService = (record: { status: string }) => {
    const query = {
      setLock: jest.fn(),
      leftJoinAndSelect: jest.fn(),
      where: jest.fn(),
      andWhere: jest.fn(),
      getOne: jest.fn().mockResolvedValue(record),
    };
    for (const name of [
      'setLock',
      'leftJoinAndSelect',
      'where',
      'andWhere',
    ] as const)
      query[name].mockReturnValue(query);
    const manager = {
      getRepository: jest
        .fn()
        .mockReturnValue({ createQueryBuilder: () => query }),
    };
    const transaction = jest
      .fn()
      .mockImplementation((callback) => callback(manager));
    const service = Object.assign(
      Object.create(FinanceCommandService.prototype),
      {
        dataSource: { transaction },
      },
    ) as FinanceCommandService;
    return { service, transaction };
  };
  const user = { companyId: 'company-1' } as never;

  it.each([
    [
      'refund',
      'payRefund',
      RefundStatus.APPROVED,
      'VERIFIED_REFUND_SETTLEMENT_REQUIRED',
    ],
    [
      'commission',
      'payCommissionPayment',
      CommissionPaymentStatus.APPROVED,
      'VERIFIED_COMMISSION_SETTLEMENT_REQUIRED',
    ],
  ] as const)(
    'rejects %s paid transition without verified settlement',
    async (_name, method, status, code) => {
      const { service, transaction } = buildService({ status });
      await expect(
        service[method](user, 'payment-id', {} as never),
      ).rejects.toMatchObject({ response: { code } });
      expect(transaction).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    ['payRefund', RefundStatus.PAID],
    ['payCommissionPayment', CommissionPaymentStatus.PAID],
  ] as const)(
    'keeps %s retries idempotent for historical paid records',
    async (method, status) => {
      const { service } = buildService({ status });
      await expect(
        service[method](user, 'payment-id', {} as never),
      ).resolves.toMatchObject({ status });
    },
  );
});
