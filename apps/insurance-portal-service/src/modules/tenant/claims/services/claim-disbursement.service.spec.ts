import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  ClaimDisbursementStatus,
  ClaimPaymentStatus,
} from '../enums/claim.enums';
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

  describe('separation of duties', () => {
    function makeSodHarness(disbursement: any, payment: any) {
      const queryBuilder = (result: any) => ({
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(result),
        getOneOrFail: jest.fn().mockResolvedValue(result),
      });
      const save = jest.fn().mockImplementation(async (value) => value);
      const manager = {
        getRepository: (entity: any) => {
          switch (entity?.name) {
            case 'ClaimDisbursement':
              return {
                createQueryBuilder: () => queryBuilder(disbursement),
                save,
              };
            case 'ClaimPayment':
              return {
                createQueryBuilder: () => queryBuilder(payment),
                findOneOrFail: jest.fn().mockResolvedValue(payment),
                save,
              };
            default:
              throw new Error(`Unexpected entity ${entity?.name}`);
          }
        },
      };
      const service = new ClaimDisbursementService(
        { transaction: (fn: any) => fn(manager) } as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
      );
      return { service, save };
    }

    const requested = (overrides: any = {}) => ({
      id: 'disb-1',
      claim_id: 'claim-1',
      claim_payment_id: 'payment-1',
      status: ClaimDisbursementStatus.REQUESTED,
      requested_by: 'claims-requester',
      ...overrides,
    });
    const approvedPayment = (overrides: any = {}) => ({
      id: 'payment-1',
      created_by: 'claims-officer',
      submitted_by: 'claims-officer',
      approved_by: 'claims-manager',
      ...overrides,
    });

    it.each([
      ['approved the payment', approvedPayment({ approved_by: 'finance-user' })],
      ['created the payment', approvedPayment({ created_by: 'finance-user' })],
      [
        'submitted the payment',
        approvedPayment({ submitted_by: 'finance-user' }),
      ],
    ])('refuses confirmation by the person who %s', async (_label, payment) => {
      const { service, save } = makeSodHarness(requested(), payment);

      await expect(
        service.confirmDisbursement(user, 'disb-1', 'BANK', null),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(save).not.toHaveBeenCalled();
    });

    it('refuses confirmation by the person who requested the disbursement', async () => {
      const { service, save } = makeSodHarness(
        requested({ requested_by: 'finance-user' }),
        approvedPayment(),
      );

      await expect(
        service.confirmDisbursement(user, 'disb-1', 'BANK', null),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(save).not.toHaveBeenCalled();
    });

    it('refuses reversal by the person who confirmed the disbursement', async () => {
      const { service, save } = makeSodHarness(
        requested({
          status: ClaimDisbursementStatus.PAID,
          confirmed_by: 'finance-user',
        }),
        approvedPayment(),
      );

      await expect(
        service.reverseDisbursement(user, 'disb-1', 'wrong payee'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(save).not.toHaveBeenCalled();
    });
  });
});
