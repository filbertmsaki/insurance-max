import { ForbiddenException, ConflictException } from '@nestjs/common';
import {
  ClaimDecisionStatus,
  ClaimSettlementStatus,
  ClaimStage,
} from '../enums/claim.enums';
import { ClaimDecisionService } from './claim-decision.service';

function makeDecision(overrides: Record<string, unknown> = {}) {
  return {
    id: 'decision-1',
    company_id: 'company-1',
    claim_id: 'claim-1',
    created_by: 'maker-user',
    submitted_by: 'maker-user',
    status: ClaimDecisionStatus.SUBMITTED,
    liability_status: 'ADMITTED',
    amount_admitted: '40000.00',
    decision_type: 'ADMIT',
    ...overrides,
  } as any;
}

function makeClaim() {
  return {
    id: 'claim-1',
    liability_status: 'PENDING',
    approved_amount: '0.00',
    claim_stage: ClaimStage.ASSESSMENT,
    settlement_status: ClaimSettlementStatus.NOT_READY,
    state_version: 1,
  } as any;
}

function makeHarness(decision: any, claim: any) {
  const decisionRepo = {
    createQueryBuilder: () => ({
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(decision),
    }),
    save: jest.fn().mockImplementation(async (value) => value),
  };

  const claimRepo = {
    createQueryBuilder: () => ({
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOneOrFail: jest.fn().mockResolvedValue(claim),
    }),
    save: jest.fn().mockImplementation(async (value) => value),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };

  const manager = {
    getRepository: (entity: any) =>
      entity?.name === 'ClaimDecision' ? decisionRepo : claimRepo,
  };

  const dataSource = {
    transaction: jest.fn().mockImplementation(async (fn: any) => fn(manager)),
  } as any;

  // Claim scope is enforced by ClaimAccessService.
  const access = { getForWrite: jest.fn().mockResolvedValue(claim) };

  const service = new ClaimDecisionService(
    dataSource,
    decisionRepo as any,
    claimRepo as any,
    {} as any,
    access as any,
    {} as any,
  );

  return { service, access, claimRepo };
}

describe('ClaimDecisionService.approve', () => {
  it('rejects the maker approving their own decision', async () => {
    const { service } = makeHarness(makeDecision(), makeClaim());

    await expect(
      service.approve(
        { id: 'maker-user', companyId: 'company-1' } as any,
        'decision-1',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows a different checker to approve and updates claim liability/settlement', async () => {
    const { service, access, claimRepo } = makeHarness(
      makeDecision(),
      makeClaim(),
    );

    const result = await service.approve(
      { id: 'checker-user', companyId: 'company-1' } as any,
      'decision-1',
    );

    expect(result.decision.status).toBe(ClaimDecisionStatus.APPROVED);
    expect(result.claim.liability_status).toBe('ADMITTED');
    expect(result.claim.approved_amount).toBe('40000.00');
    // claim_stage is derived from the lifecycle status, never set here.
    expect(result.claim.claim_stage).toBe(ClaimStage.ASSESSMENT);
    expect(result.claim.settlement_status).toBe(
      ClaimSettlementStatus.DISCHARGE_PENDING,
    );
    expect(access.getForWrite).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'checker-user' }),
      'claim-1',
      expect.anything(),
    );
    expect(claimRepo.update).toHaveBeenCalledWith(
      { id: 'claim-1' },
      expect.objectContaining({ approved_amount: '40000.00' }),
    );
  });

  it('rejects approval from a non-submitted decision', async () => {
    const { service } = makeHarness(
      makeDecision({ status: ClaimDecisionStatus.APPROVED }),
      makeClaim(),
    );

    await expect(
      service.approve(
        { id: 'checker-user', companyId: 'company-1' } as any,
        'decision-1',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('routes a DENY decision to NO_PAYMENT_REQUIRED settlement', async () => {
    const { service } = makeHarness(
      makeDecision({ decision_type: 'DENY', liability_status: 'DENIED' }),
      makeClaim(),
    );

    const result = await service.approve(
      { id: 'checker-user', companyId: 'company-1' } as any,
      'decision-1',
    );

    expect(result.claim.settlement_status).toBe(
      ClaimSettlementStatus.NO_PAYMENT_REQUIRED,
    );
  });
});
