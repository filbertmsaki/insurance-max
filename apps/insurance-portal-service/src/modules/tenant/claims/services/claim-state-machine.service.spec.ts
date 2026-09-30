import { ConflictException } from '@nestjs/common';

import { ClaimStage, ClaimStatus } from '../enums/claim.enums';
import { ClaimStateMachineService } from './claim-state-machine.service';

function makeManager(affected = 1) {
  const updateBuilder = {
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ affected }),
  };
  const insertBuilder = {
    insert: jest.fn().mockReturnThis(),
    into: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    orIgnore: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({}),
  };
  const historySave = jest.fn().mockResolvedValue({});
  let call = 0;

  const manager = {
    createQueryBuilder: jest.fn(() => (call++ === 0 ? updateBuilder : insertBuilder)),
    getRepository: jest.fn(() => ({ save: historySave })),
  } as any;

  return { manager, updateBuilder, insertBuilder, historySave };
}

function makeClaim(status: ClaimStatus) {
  return {
    id: 'claim-1',
    company_id: 'company-1',
    claim_no: 'CLM-2026-00001',
    status,
    state_version: 4,
  } as any;
}

describe('ClaimStateMachineService', () => {
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const service = new ClaimStateMachineService(audit as any);

  it('rejects a transition that skips a stage', async () => {
    const { manager } = makeManager();

    await expect(
      service.transition(manager, makeClaim(ClaimStatus.DRAFT), ClaimStatus.INTIMATED, {
        summary: 'skip',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(manager.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('applies an allowed transition with optimistic locking and history', async () => {
    const { manager, updateBuilder, insertBuilder, historySave } = makeManager();
    const claim = makeClaim(ClaimStatus.DRAFT);

    await service.transition(manager, claim, ClaimStatus.NOTIFICATION_SUBMITTED, {
      summary: 'submitted',
      actorId: 'user-1',
    });

    expect(updateBuilder.andWhere).toHaveBeenCalledWith('status = :from', {
      from: ClaimStatus.DRAFT,
    });
    expect(updateBuilder.andWhere).toHaveBeenCalledWith('state_version = :version', {
      version: 4,
    });
    expect(claim.status).toBe(ClaimStatus.NOTIFICATION_SUBMITTED);
    expect(claim.claim_stage).toBe(ClaimStage.NOTIFICATION_PENDING);
    expect(claim.state_version).toBe(5);
    expect(historySave).toHaveBeenCalledWith(
      expect.objectContaining({
        old_status: ClaimStatus.DRAFT,
        new_status: ClaimStatus.NOTIFICATION_SUBMITTED,
      }),
    );
    expect(insertBuilder.orIgnore).toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'claim.status_changed' }),
      manager,
    );
  });

  it('fails when another action changed the claim concurrently', async () => {
    const { manager } = makeManager(0);

    await expect(
      service.transition(
        manager,
        makeClaim(ClaimStatus.DRAFT),
        ClaimStatus.NOTIFICATION_SUBMITTED,
        { summary: 'race' },
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'CLAIM_CONCURRENT_MODIFICATION' }),
    });
  });

  it('treats a replayed callback as a no-op', async () => {
    const { manager } = makeManager();
    const claim = makeClaim(ClaimStatus.NOTIFICATION_ACCEPTED);

    const moved = await service.transitionIfIn(
      manager,
      claim,
      [ClaimStatus.NOTIFICATION_SUBMITTED],
      ClaimStatus.NOTIFICATION_ACCEPTED,
      { summary: 'replay' },
    );

    expect(moved).toBe(false);
    expect(manager.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('returns a declined rejection only to a rejectable status', async () => {
    const { manager } = makeManager();

    await expect(
      service.revertPendingRejection(
        manager,
        makeClaim(ClaimStatus.REJECTION_PENDING),
        ClaimStatus.PAID,
        { summary: 'invalid' },
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    const claim = makeClaim(ClaimStatus.REJECTION_PENDING);
    await service.revertPendingRejection(manager, claim, ClaimStatus.INTIMATED, {
      summary: 'declined',
    });
    expect(claim.status).toBe(ClaimStatus.INTIMATED);
  });
});
