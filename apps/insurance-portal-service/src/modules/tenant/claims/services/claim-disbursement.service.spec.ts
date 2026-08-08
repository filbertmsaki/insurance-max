import { BadRequestException } from '@nestjs/common';
import { ClaimPaymentStatus } from '../enums/claim.enums';
import { ClaimDisbursementService } from './claim-disbursement.service';

function makeHarness(params: {
  payment: any;
  claim: any;
  existingDisbursement?: any;
}) {
  const disbursementRepo = {
    findOne: jest.fn().mockResolvedValue(params.existingDisbursement ?? null),
    save: jest
      .fn()
      .mockImplementation(async (value) => ({ id: 'disb-1', ...value })),
  };

  const paymentRepo = {
    createQueryBuilder: () => ({
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(params.payment),
    }),
    save: jest.fn().mockImplementation(async (value) => value),
  };

  const claimRepo = {
    createQueryBuilder: () => ({
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOneOrFail: jest.fn().mockResolvedValue(params.claim),
    }),
  };

  const manager = {
    getRepository: (entity: any) => {
      switch (entity?.name) {
        case 'ClaimDisbursement':
          return disbursementRepo;
        case 'ClaimPayment':
          return paymentRepo;
        case 'InsuranceClaim':
          return claimRepo;
        default:
          throw new Error(`Unexpected entity ${entity?.name}`);
      }
    },
  };

  const dataSource = {
    transaction: jest.fn().mockImplementation(async (fn: any) => fn(manager)),
  } as any;

  const referenceService = {
    next: jest.fn().mockResolvedValue('DSB-2026-00001'),
  } as any;

  const financeJournalService = {
    postClaimDisbursement: jest.fn().mockResolvedValue(undefined),
  } as any;

  const financialProjectionService = {
    recalculate: jest.fn().mockResolvedValue(undefined),
  } as any;

  const service = new ClaimDisbursementService(
    dataSource,
    referenceService,
    financeJournalService,
    financialProjectionService,
  );

  return { service, disbursementRepo, paymentRepo };
}

describe('ClaimDisbursementService', () => {
  const user = { id: 'finance-user', companyId: 'company-1' } as any;

  describe('requestDisbursement', () => {
    it('rejects a payment that exceeds the remaining admitted amount', async () => {
      const { service } = makeHarness({
        payment: {
          id: 'payment-1',
          claim_id: 'claim-1',
          status: ClaimPaymentStatus.APPROVED,
          paid_amount: '60000.00',
          currency_code: 'TZS',
        },
        claim: {
          id: 'claim-1',
          approved_amount: '50000.00',
          paid_amount: '0.00',
        },
      });

      await expect(
        service.requestDisbursement(user, 'payment-1', 'idem-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates a disbursement when the payment is within the admitted amount', async () => {
      const { service, disbursementRepo } = makeHarness({
        payment: {
          id: 'payment-1',
          claim_id: 'claim-1',
          status: ClaimPaymentStatus.APPROVED,
          paid_amount: '20000.00',
          currency_code: 'TZS',
        },
        claim: {
          id: 'claim-1',
          approved_amount: '50000.00',
          paid_amount: '0.00',
        },
      });

      const disbursement = await service.requestDisbursement(
        user,
        'payment-1',
        'idem-1',
      );

      expect(disbursement).toBeDefined();
      expect(disbursementRepo.save).toHaveBeenCalled();
    });

    it('returns the existing disbursement for a repeated idempotency key', async () => {
      const existing = { id: 'disb-existing' };
      const { service, disbursementRepo } = makeHarness({
        payment: {
          id: 'payment-1',
          claim_id: 'claim-1',
          status: ClaimPaymentStatus.APPROVED,
          paid_amount: '20000.00',
          currency_code: 'TZS',
        },
        claim: {
          id: 'claim-1',
          approved_amount: '50000.00',
          paid_amount: '0.00',
        },
        existingDisbursement: existing,
      });

      const result = await service.requestDisbursement(
        user,
        'payment-1',
        'idem-1',
      );

      expect(result).toBe(existing);
      expect(disbursementRepo.save).not.toHaveBeenCalled();
    });
  });
});
