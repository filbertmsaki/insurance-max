import { PolicyTransactionType } from '@insurance-max/contracts';
import { PolicyTransactionEligibilityService } from './policy-transaction-eligibility.service';

function makePolicy(overrides: Record<string, unknown> = {}) {
  return {
    id: 'policy-1',
    company_id: 'company-1',
    policy_status: 'ACTIVE',
    pending_transaction_id: null,
    start_date: '2026-01-01',
    end_date: '2026-12-31',
    ...overrides,
  } as any;
}

function makeManager(
  options: {
    currentVersion?: any;
    openClaimCount?: number;
  } = {},
) {
  const policyVersionRepo = {
    findOne: jest.fn().mockResolvedValue(
      options.currentVersion === undefined
        ? {
            id: 'version-1',
            effective_from: '2026-01-01',
            version_number: 1,
            policy_snapshot: {},
            policy_snapshot_hash: 'hash',
          }
        : options.currentVersion,
    ),
  };
  const claimRepo = {
    count: jest.fn().mockResolvedValue(options.openClaimCount ?? 0),
  };

  return {
    getRepository: (entity: any) => {
      if (entity?.name === 'InsuranceClaim') {
        return claimRepo;
      }
      return policyVersionRepo;
    },
  } as any;
}

describe('PolicyTransactionEligibilityService', () => {
  const service = new PolicyTransactionEligibilityService();

  it('blocks an inactive policy', async () => {
    const result = await service.validate(
      makeManager(),
      makePolicy({ policy_status: 'DRAFT' }),
      PolicyTransactionType.ENDORSEMENT,
      '2026-06-01',
    );

    expect(result.eligible).toBe(false);
    expect(result.blockers.map((b) => b.code)).toContain('POLICY_NOT_ACTIVE');
  });

  it('blocks a policy that already has an active transaction', async () => {
    const result = await service.validate(
      makeManager(),
      makePolicy({ pending_transaction_id: 'txn-1' }),
      PolicyTransactionType.ENDORSEMENT,
      '2026-06-01',
    );

    expect(result.eligible).toBe(false);
    expect(result.blockers.map((b) => b.code)).toContain(
      'POLICY_TRANSACTION_ALREADY_ACTIVE',
    );
  });

  it('blocks an effective date outside the policy period', async () => {
    const result = await service.validate(
      makeManager(),
      makePolicy(),
      PolicyTransactionType.ENDORSEMENT,
      '2027-01-15',
    );

    expect(result.eligible).toBe(false);
    expect(result.blockers.map((b) => b.code)).toContain(
      'EFFECTIVE_DATE_OUTSIDE_POLICY_PERIOD',
    );
  });

  it('blocks a transaction that precedes the current policy version', async () => {
    const result = await service.validate(
      makeManager({
        currentVersion: {
          id: 'version-1',
          effective_from: '2026-08-01',
          version_number: 2,
          policy_snapshot: {},
          policy_snapshot_hash: 'hash',
        },
      }),
      makePolicy(),
      PolicyTransactionType.ENDORSEMENT,
      '2026-06-01',
    );

    expect(result.eligible).toBe(false);
    expect(result.blockers.map((b) => b.code)).toContain(
      'TRANSACTION_PRECEDES_CURRENT_VERSION',
    );
  });

  it('is eligible when every check passes', async () => {
    const result = await service.validate(
      makeManager(),
      makePolicy(),
      PolicyTransactionType.ENDORSEMENT,
      '2026-06-01',
    );

    expect(result.eligible).toBe(true);
    expect(result.blockers).toHaveLength(0);
  });

  it('flags claims-review as required without blocking cancellation eligibility', async () => {
    const result = await service.validate(
      makeManager({ openClaimCount: 1 }),
      makePolicy(),
      PolicyTransactionType.CANCELLATION,
      '2026-06-01',
    );

    expect(result.eligible).toBe(true);
    expect(result.claimsReviewRequired).toBe(true);
  });
});
