import { ClaimCoverageStatus } from '../enums/claim.enums';
import { ClaimCoverageService } from './claim-coverage.service';

function fakeHashService() {
  return { hashDefinition: (value: unknown) => JSON.stringify(value) } as any;
}

function makePolicy(overrides: Record<string, unknown> = {}) {
  return {
    id: 'policy-1',
    policy_no: 'POL-1',
    policy_reference_number: 'REF-1',
    cancellation_effective_date: null,
    ...overrides,
  } as any;
}

function makeManager(version: any) {
  return {
    getRepository: () => ({
      createQueryBuilder: () => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(version),
      }),
    }),
  } as any;
}

describe('ClaimCoverageService', () => {
  const service = new ClaimCoverageService(fakeHashService());

  it('declines when no policy version was effective on the loss date', async () => {
    const result = await service.evaluate(
      makeManager(null),
      makePolicy(),
      '2026-06-01',
    );

    expect(result.covered).toBe(false);
    expect(result.status).toBe(ClaimCoverageStatus.DECLINED);
    expect(result.blockers[0].code).toBe('NO_EFFECTIVE_POLICY_VERSION');
  });

  it('confirms coverage when the loss predates a later cancellation', async () => {
    const version = {
      id: 'version-1',
      version_number: 1,
      effective_from: '2026-01-01',
      effective_to: '2026-12-31',
      policy_snapshot: {},
      policy_snapshot_hash: 'hash',
    };

    const result = await service.evaluate(
      makeManager(version),
      makePolicy({ cancellation_effective_date: '2026-08-01' }),
      '2026-06-01',
    );

    expect(result.covered).toBe(true);
    expect(result.status).toBe(ClaimCoverageStatus.CONFIRMED);
  });

  it('declines when the loss occurred on or after the cancellation effective date', async () => {
    const version = {
      id: 'version-1',
      version_number: 1,
      effective_from: '2026-01-01',
      effective_to: '2026-12-31',
      policy_snapshot: {},
      policy_snapshot_hash: 'hash',
    };

    const result = await service.evaluate(
      makeManager(version),
      makePolicy({ cancellation_effective_date: '2026-08-01' }),
      '2026-08-01',
    );

    expect(result.covered).toBe(false);
    expect(result.blockers[0].code).toBe('LOSS_AFTER_CANCELLATION');
  });

  it('produces a deterministic coverage snapshot hash', async () => {
    const version = {
      id: 'version-1',
      version_number: 1,
      effective_from: '2026-01-01',
      effective_to: '2026-12-31',
      policy_snapshot: {},
      policy_snapshot_hash: 'hash',
    };

    const first = await service.evaluate(
      makeManager(version),
      makePolicy(),
      '2026-06-01',
    );
    const second = await service.evaluate(
      makeManager(version),
      makePolicy(),
      '2026-06-01',
    );

    expect(first.coverageSnapshotHash).toBe(second.coverageSnapshotHash);
  });
});
