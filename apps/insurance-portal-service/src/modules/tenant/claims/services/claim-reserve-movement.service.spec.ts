import { ClaimReserveMovementType } from '@insurance-max/contracts';
import { ClaimReserveMovementService } from './claim-reserve-movement.service';

function makeReserve() {
  return {
    id: 'reserve-1',
    company_id: 'company-1',
    claim_id: 'claim-1',
    currency: 'TZS',
    effective_at: new Date('2026-06-01T00:00:00.000Z'),
  } as any;
}

function makeManager(existing: any = null) {
  const movementRepo = {
    findOne: jest.fn().mockResolvedValue(existing),
    save: jest
      .fn()
      .mockImplementation(async (value) => ({ id: 'movement-1', ...value })),
  };

  return {
    getRepository: () => movementRepo,
    __movementRepo: movementRepo,
  } as any;
}

describe('ClaimReserveMovementService', () => {
  const referenceService = {
    next: jest.fn().mockResolvedValue('RSM-00001'),
  } as any;
  const service = new ClaimReserveMovementService(referenceService);

  it('stores a positive amount for an INCREASE movement', async () => {
    const manager = makeManager();

    const movement = await service.record(
      manager,
      makeReserve(),
      ClaimReserveMovementType.INCREASE,
      '5000.00',
      'Additional exposure identified',
      'reserve-approved:reserve-1',
      'user-1',
    );

    expect(movement.signed_amount).toBe('5000.00');
    expect(movement.amount).toBe('5000.00');
  });

  it('stores the absolute value in `amount` for a negative (RELEASE) movement', async () => {
    const manager = makeManager();

    const movement = await service.record(
      manager,
      makeReserve(),
      ClaimReserveMovementType.RELEASE,
      '-2000.00',
      'Reserve no longer required',
      'reserve-released:reserve-1',
      'user-1',
    );

    expect(movement.signed_amount).toBe('-2000.00');
    expect(movement.amount).toBe('2000.00');
  });

  it('is idempotent per source_event_id', async () => {
    const existing = { id: 'movement-existing' };
    const manager = makeManager(existing);

    const movement = await service.record(
      manager,
      makeReserve(),
      ClaimReserveMovementType.INCREASE,
      '5000.00',
      'reason',
      'reserve-approved:reserve-1',
      'user-1',
    );

    expect(movement).toBe(existing);
    expect(manager.__movementRepo.save).not.toHaveBeenCalled();
  });
});
