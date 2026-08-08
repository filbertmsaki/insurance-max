import { ConflictException, ForbiddenException } from '@nestjs/common';

import { ReinsuranceSettlementStatus } from '../enums/reinsurance.enums';
import { ReinsuranceSettlementService } from './reinsurance-settlement.service';

function makeSettlement(overrides: Record<string, unknown> = {}) {
  return {
    id: 'settlement-1',
    company_id: 'company-1',
    counterparty_company_id: 'counterparty-1',
    settlement_no: 'RIS-2026-00001',
    settlement_type: 'PREMIUM',
    currency: 'TZS',
    net_amount: '10000.00',
    paid_amount: '0.00',
    balance_amount: '10000.00',
    status: ReinsuranceSettlementStatus.SUBMITTED,
    submitted_by: 'maker-user',
    ...overrides,
  } as any;
}

function makeHarness(settlement: any) {
  const settlementRepository = {
    findOne: jest.fn().mockResolvedValue(settlement),
    save: jest.fn().mockImplementation(async (value: any) => value),
  };

  const scopeService = {
    resolve: jest.fn().mockReturnValue({ companyId: 'company-1' }),
  };

  const referenceService = {
    next: jest.fn().mockResolvedValue('RIS-2026-00002'),
  };

  const financeJournalService = {
    postReinsuranceSettlement: jest.fn().mockResolvedValue({ id: 'journal-1' }),
  };

  const manager = {
    getRepository: () => ({
      findOneOrFail: jest.fn().mockResolvedValue({ ...settlement }),
      save: jest.fn().mockImplementation(async (value: any) => value),
    }),
  };

  const dataSource = {
    transaction: jest.fn().mockImplementation(async (fn: any) => fn(manager)),
  };

  const service = new ReinsuranceSettlementService(
    dataSource as any,
    settlementRepository as any,
    scopeService as any,
    referenceService as any,
    financeJournalService as any,
  );

  return { service, settlementRepository, financeJournalService };
}

describe('ReinsuranceSettlementService', () => {
  const submitter = { id: 'maker-user', companyId: 'company-1' } as any;
  const approver = { id: 'checker-user', companyId: 'company-1' } as any;

  describe('approve', () => {
    it('rejects the submitter approving their own settlement', async () => {
      const { service } = makeHarness(makeSettlement());

      await expect(
        service.approve(submitter, 'settlement-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('allows a different user to approve', async () => {
      const { service } = makeHarness(makeSettlement());

      const result = await service.approve(approver, 'settlement-1');

      expect(result.status).toBe(ReinsuranceSettlementStatus.APPROVED);
      expect(result.approved_by).toBe('checker-user');
    });

    it('rejects approving a non-submitted settlement', async () => {
      const { service } = makeHarness(
        makeSettlement({ status: ReinsuranceSettlementStatus.DRAFT }),
      );

      await expect(
        service.approve(approver, 'settlement-1'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('confirmPayment', () => {
    it('rejects the submitter confirming their own settlement payment', async () => {
      const { service } = makeHarness(
        makeSettlement({ status: ReinsuranceSettlementStatus.APPROVED }),
      );

      await expect(
        service.confirmPayment(submitter, 'settlement-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('posts exactly one finance journal entry and marks the settlement paid', async () => {
      const { service, financeJournalService } = makeHarness(
        makeSettlement({ status: ReinsuranceSettlementStatus.APPROVED }),
      );

      const result = await service.confirmPayment(approver, 'settlement-1');

      expect(
        financeJournalService.postReinsuranceSettlement,
      ).toHaveBeenCalledTimes(1);
      expect(result.status).toBe(ReinsuranceSettlementStatus.PAID);
      expect(result.settled_by).toBe('checker-user');
    });

    it('rejects confirming payment on a non-approved settlement', async () => {
      const { service } = makeHarness(
        makeSettlement({ status: ReinsuranceSettlementStatus.SUBMITTED }),
      );

      await expect(
        service.confirmPayment(approver, 'settlement-1'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
