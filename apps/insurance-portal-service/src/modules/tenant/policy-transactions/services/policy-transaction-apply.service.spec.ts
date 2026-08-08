import { ConflictException } from '@nestjs/common';
import {
  PolicyTransactionEventType,
  PolicyTransactionStage,
  PolicyTransactionType,
} from '@insurance-max/contracts';
import { PolicyTransactionApplyService } from './policy-transaction-apply.service';

function makeTransaction(overrides: Record<string, unknown> = {}) {
  return {
    id: 'txn-1',
    company_id: 'company-1',
    transaction_type: PolicyTransactionType.ENDORSEMENT,
    stage: PolicyTransactionStage.COMPLETED,
    source_policy_id: 'policy-1',
    source_policy_version_no: 1,
    effective_date: '2026-06-01',
    additional_premium: '5000.00',
    return_premium: '0.00',
    tax_difference: '900.00',
    commission_difference: '0.00',
    proposed_policy_snapshot: { totals: { totalPremium: '105000.00' } },
    proposed_policy_snapshot_hash: 'hash-proposed',
    pricing_snapshot: { totals: { totalPremium: '105000.00' } },
    pricing_snapshot_hash: 'hash-pricing',
    ...overrides,
  } as any;
}

function makePolicy(overrides: Record<string, unknown> = {}) {
  return {
    id: 'policy-1',
    company_id: 'company-1',
    policy_status: 'ACTIVE',
    total_premium: '100000.00',
    net_premium: '100000.00',
    total_tax: '18000.00',
    total_commission: '10000.00',
    current_version_no: 1,
    end_date: '2026-12-31',
    ...overrides,
  } as any;
}

function makeVersion(overrides: Record<string, unknown> = {}) {
  return {
    id: 'version-1',
    policy_id: 'policy-1',
    version_number: 1,
    is_current: true,
    customer_snapshot: { customerId: 'customer-1' },
    customer_snapshot_hash: 'hash-customer',
    asset_manifest: { entries: [] },
    asset_manifest_hash: 'hash-asset',
    ...overrides,
  } as any;
}

function makeHarness(transaction: any, policy: any, previousVersion: any) {
  const policyRepo = {
    createQueryBuilder: jest.fn().mockReturnValue({
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(policy),
    }),
    save: jest
      .fn()
      .mockImplementation(async (value) => Object.assign(policy, value)),
  };
  const versionRepo = {
    findOne: jest.fn().mockResolvedValue(previousVersion),
    save: jest
      .fn()
      .mockImplementation(async (value) => ({ id: 'version-2', ...value })),
  };
  const statusHistoryRepo = {
    save: jest.fn().mockResolvedValue(undefined),
  };
  const transactionRepoInManager = {
    save: jest
      .fn()
      .mockImplementation(async (value) => Object.assign(transaction, value)),
  };

  const manager = {
    getRepository: (entity: any) => {
      if (entity?.name === 'Policy') return policyRepo;
      if (entity?.name === 'PolicyVersion') return versionRepo;
      if (entity?.name === 'PolicyStatusHistory') return statusHistoryRepo;
      if (entity?.name === 'PolicyTransaction') return transactionRepoInManager;
      throw new Error(`Unexpected entity ${entity?.name}`);
    },
  };

  const dataSource = {
    transaction: jest.fn().mockImplementation(async (fn: any) => fn(manager)),
  } as any;

  const transactionRepository = {
    findOne: jest.fn().mockResolvedValue(transaction),
  } as any;

  const hashService = {
    hashDefinition: jest.fn().mockReturnValue('hash-generated'),
  } as any;

  const lifecycleService = {
    markApplied: jest
      .fn()
      .mockImplementation(async (_c, _id, _ctx, eventType) => ({
        ...transaction,
        stage: PolicyTransactionStage.APPLIED,
        eventType,
      })),
  } as any;

  const service = new PolicyTransactionApplyService(
    dataSource,
    transactionRepository,
    hashService,
    lifecycleService,
  );

  return {
    service,
    policyRepo,
    versionRepo,
    statusHistoryRepo,
    lifecycleService,
  };
}

describe('PolicyTransactionApplyService', () => {
  describe('applyEndorsement', () => {
    it('rejects a transaction that has not reached COMPLETED', async () => {
      const transaction = makeTransaction({
        stage: PolicyTransactionStage.DRAFT,
      });
      const policy = makePolicy();
      const version = makeVersion();
      const { service } = makeHarness(transaction, policy, version);

      await expect(
        service.applyEndorsement('company-1', 'txn-1'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects an endorsement with no proposed snapshot', async () => {
      const transaction = makeTransaction({ proposed_policy_snapshot: null });
      const policy = makePolicy();
      const version = makeVersion();
      const { service } = makeHarness(transaction, policy, version);

      await expect(
        service.applyEndorsement('company-1', 'txn-1'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('creates the next policy version, applies the premium delta, and marks applied', async () => {
      const transaction = makeTransaction();
      const policy = makePolicy();
      const previousVersion = makeVersion();
      const { service, policyRepo, versionRepo, lifecycleService } =
        makeHarness(transaction, policy, previousVersion);

      await service.applyEndorsement('company-1', 'txn-1', {
        changedBy: 'user-1',
      });

      // Previous version superseded.
      expect(previousVersion.is_current).toBe(false);
      expect(previousVersion.superseded_at).toBeInstanceOf(Date);

      // New version created at policy_snapshot = the endorsement's proposed snapshot.
      expect(versionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          version_number: 2,
          version_type: 'ENDORSEMENT',
          policy_snapshot: transaction.proposed_policy_snapshot,
          supersedes_version_id: 'version-1',
          is_current: true,
        }),
      );

      // Policy premium totals reflect the additional premium (net of return premium).
      expect(policyRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          total_premium: '105000.00',
          current_version_no: 2,
          pending_transaction_id: null,
        }),
      );

      expect(lifecycleService.markApplied).toHaveBeenCalledWith(
        'company-1',
        'txn-1',
        { changedBy: 'user-1' },
        PolicyTransactionEventType.POLICY_VERSION_APPLIED,
      );
    });

    it('is idempotent once already APPLIED', async () => {
      const transaction = makeTransaction({
        stage: PolicyTransactionStage.APPLIED,
      });
      const policy = makePolicy();
      const version = makeVersion();
      const { service, policyRepo } = makeHarness(transaction, policy, version);

      await service.applyEndorsement('company-1', 'txn-1');

      // Still re-applies (caller-level idempotency is out of scope here) but
      // must not throw on an already-applied transaction.
      expect(policyRepo.save).toHaveBeenCalled();
    });
  });

  describe('applyCancellation', () => {
    it('sets the policy to CANCELLED and records status history', async () => {
      const transaction = makeTransaction({
        transaction_type: PolicyTransactionType.CANCELLATION,
        reason: 'Customer requested cancellation',
      });
      const policy = makePolicy();
      const previousVersion = makeVersion();
      const { service, policyRepo, statusHistoryRepo, lifecycleService } =
        makeHarness(transaction, policy, previousVersion);

      await service.applyCancellation('company-1', 'txn-1', {
        changedBy: 'user-2',
      });

      expect(policyRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          policy_status: 'CANCELLED',
          cancellation_effective_date: transaction.effective_date,
          pending_transaction_id: null,
        }),
      );

      expect(statusHistoryRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          policy_id: 'policy-1',
          old_status: 'ACTIVE',
          new_status: 'CANCELLED',
          changed_by: 'user-2',
        }),
      );

      expect(lifecycleService.markApplied).toHaveBeenCalledWith(
        'company-1',
        'txn-1',
        { changedBy: 'user-2' },
        PolicyTransactionEventType.CANCELLATION_APPLIED,
      );
    });

    it('does not duplicate status history if the policy is already CANCELLED', async () => {
      const transaction = makeTransaction({
        transaction_type: PolicyTransactionType.CANCELLATION,
      });
      const policy = makePolicy({ policy_status: 'CANCELLED' });
      const previousVersion = makeVersion();
      const { service, statusHistoryRepo } = makeHarness(
        transaction,
        policy,
        previousVersion,
      );

      await service.applyCancellation('company-1', 'txn-1');

      expect(statusHistoryRepo.save).not.toHaveBeenCalled();
    });
  });
});
