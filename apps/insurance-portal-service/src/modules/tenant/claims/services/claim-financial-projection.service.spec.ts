import { ClaimFinancialProjectionService } from './claim-financial-projection.service';

function makeClaim() {
  return {
    id: 'claim-1',
    gross_case_reserve: '0.00',
    gross_incurred_amount: '0.00',
    expense_paid_amount: '0.00',
    indemnity_paid_amount: '0.00',
    total_recovery_expected: '0.00',
    total_recovery_received: '0.00',
    net_incurred_amount: '0.00',
  } as any;
}

function makeManager(params: {
  claim: any;
  reserveTotal: string;
  paidTotal: string;
  expenseTotal: string;
  recoveryExpected: string;
  recoveryReceived: string;
}) {
  let totalCallIndex = 0;
  const paymentTotals = [params.paidTotal, params.expenseTotal];

  const claimRepo = {
    createQueryBuilder: () => ({
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOneOrFail: jest.fn().mockResolvedValue(params.claim),
    }),
    save: jest.fn().mockImplementation(async (value) => value),
  };

  const movementRepo = {
    createQueryBuilder: () => ({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ total: params.reserveTotal }),
    }),
  };

  const paymentRepo = {
    createQueryBuilder: () => ({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest
        .fn()
        .mockImplementation(async () => ({
          total: paymentTotals[totalCallIndex++] ?? '0.00',
        })),
    }),
  };

  let recoveryCallIndex = 0;
  const recoveryTotals = [params.recoveryExpected, params.recoveryReceived];
  const recoveryRepo = {
    createQueryBuilder: () => ({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest
        .fn()
        .mockImplementation(async () => ({
          total: recoveryTotals[recoveryCallIndex++] ?? '0.00',
        })),
    }),
  };

  return {
    getRepository: (entity: any) => {
      switch (entity?.name) {
        case 'InsuranceClaim':
          return claimRepo;
        case 'ClaimReserveMovement':
          return movementRepo;
        case 'ClaimPayment':
          return paymentRepo;
        case 'ClaimRecovery':
          return recoveryRepo;
        default:
          throw new Error(`Unexpected entity ${entity?.name}`);
      }
    },
  } as any;
}

describe('ClaimFinancialProjectionService', () => {
  const service = new ClaimFinancialProjectionService();

  it('derives incurred/outstanding-reserve figures from movements, payments and recoveries', async () => {
    const claim = makeClaim();
    const manager = makeManager({
      claim,
      reserveTotal: '100000.00',
      paidTotal: '40000.00',
      expenseTotal: '5000.00',
      recoveryExpected: '10000.00',
      recoveryReceived: '2000.00',
    });

    const result = await service.recalculate(manager, claim.id);

    expect(result.gross_case_reserve).toBe('100000.00');
    // outstanding = reserveTotal - paid = 60000; grossIncurred = paid + outstanding = 100000
    expect(result.gross_incurred_amount).toBe('100000.00');
    expect(result.expense_paid_amount).toBe('5000.00');
    expect(result.indemnity_paid_amount).toBe('35000.00');
    expect(result.total_recovery_expected).toBe('10000.00');
    expect(result.total_recovery_received).toBe('2000.00');
    // netIncurred = grossIncurred - recoveryExpected = 90000
    expect(result.net_incurred_amount).toBe('90000.00');
  });

  it('floors outstanding reserve and net incurred at zero', async () => {
    const claim = makeClaim();
    const manager = makeManager({
      claim,
      reserveTotal: '10000.00',
      paidTotal: '15000.00',
      expenseTotal: '0.00',
      recoveryExpected: '50000.00',
      recoveryReceived: '0.00',
    });

    const result = await service.recalculate(manager, claim.id);

    expect(Number(result.gross_incurred_amount)).toBeGreaterThanOrEqual(0);
    expect(Number(result.net_incurred_amount)).toBe(0);
  });
});
