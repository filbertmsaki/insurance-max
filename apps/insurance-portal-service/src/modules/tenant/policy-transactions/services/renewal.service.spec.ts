import { ConflictException } from '@nestjs/common';
import {
  PolicyTransactionEventType,
  PolicyTransactionStage,
  RenewalLifecycleStatus,
} from '@insurance-max/contracts';

import { Policy } from '../../policies/entities/policy.entity';
import { PolicyVersion } from '../../policies/entities/policy-version.entity';
import { PolicyRenewal } from '../entities/policy-renewal.entity';
import { PolicyTransaction } from '../entities/policy-transaction.entity';
import { PolicyTransactionEvent } from '../entities/policy-transaction-event.entity';
import { RenewalService } from './renewal.service';

describe('RenewalService', () => {
  const user = { id: 'user-1', companyId: 'company-1' } as any;

  let renewal: PolicyRenewal;
  let transaction: PolicyTransaction;
  let sourcePolicy: Policy;
  let repositories: Map<unknown, Record<string, jest.Mock>>;
  let renewalRepository: Record<string, jest.Mock>;
  let transactionRepository: Record<string, jest.Mock>;
  let policyRepository: Record<string, jest.Mock>;
  let service: RenewalService;

  beforeEach(() => {
    renewal = {
      id: 'renewal-1',
      company_id: 'company-1',
      policy_transaction_id: 'txn-1',
      renewal_no: 'REN-001',
      renewal_status: RenewalLifecycleStatus.OFFER_SENT,
      renewal_quotation_id: 'quotation-2',
      offer_expires_at: null,
    } as PolicyRenewal;
    transaction = {
      id: 'txn-1',
      company_id: 'company-1',
      source_policy_id: 'policy-1',
      source_policy_version_id: 'version-1',
      stage: PolicyTransactionStage.DRAFT,
      state_version: 1,
    } as PolicyTransaction;
    sourcePolicy = {
      id: 'policy-1',
      company_id: 'company-1',
      active_version_id: 'version-1',
      pending_transaction_id: 'txn-1',
    } as Policy;

    const save = (value: unknown) => Promise.resolve(value);
    repositories = new Map<unknown, Record<string, jest.Mock>>([
      [PolicyRenewal, { save: jest.fn(save) }],
      [
        PolicyTransaction,
        {
          findOne: jest.fn(async () => transaction),
          findOneOrFail: jest.fn(async () => transaction),
          save: jest.fn(save),
        },
      ],
      [
        Policy,
        {
          update: jest.fn(async () => ({ affected: 1 })),
          save: jest.fn(save),
        },
      ],
      [PolicyTransactionEvent, { save: jest.fn(save) }],
      [PolicyVersion, { findOne: jest.fn(async () => null) }],
    ]);
    const manager = {
      getRepository: jest.fn((entity: unknown) => {
        const repository = repositories.get(entity);
        if (!repository) {
          throw new Error(`Unexpected repository: ${String(entity)}`);
        }
        return repository;
      }),
    };
    const dataSource = {
      transaction: jest.fn((handler: (value: unknown) => unknown) =>
        handler(manager),
      ),
    };

    renewalRepository = {
      findOne: jest.fn(async () => renewal),
      find: jest.fn(async () => [renewal]),
      save: jest.fn(save),
    };
    transactionRepository = { findOne: jest.fn(async () => transaction) };
    policyRepository = {
      findOne: jest.fn(async () => sourcePolicy),
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn(async () => []),
      })),
    };

    service = new RenewalService(
      dataSource as any,
      policyRepository as any,
      transactionRepository as any,
      renewalRepository as any,
      {} as any,
      {} as any,
      {} as any,
      { get: jest.fn(() => undefined) } as any,
      {} as any,
      { hashDefinition: jest.fn(() => 'hash') } as any,
    );
  });

  describe('decline', () => {
    it('cancels the renewal transaction and releases the source policy', async () => {
      const result = await service.decline(user, 'renewal-1', 'Too costly');

      expect(result.renewal_status).toBe(
        RenewalLifecycleStatus.CUSTOMER_DECLINED,
      );
      expect(repositories.get(Policy)!.update).toHaveBeenCalledWith(
        {
          id: 'policy-1',
          company_id: 'company-1',
          pending_transaction_id: 'txn-1',
        },
        { pending_transaction_id: null },
      );
      expect(transaction).toMatchObject({
        stage: PolicyTransactionStage.CANCELLED,
        cancelled_by: 'user-1',
        cancellation_reason: 'Too costly',
      });
      expect(
        repositories.get(PolicyTransactionEvent)!.save,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: PolicyTransactionEventType.CANCELLED,
          from_stage: PolicyTransactionStage.DRAFT,
          to_stage: PolicyTransactionStage.CANCELLED,
        }),
      );
    });

    it('does not move an already terminal transaction', async () => {
      transaction.stage = PolicyTransactionStage.APPLIED;
      renewal.renewal_status = RenewalLifecycleStatus.CUSTOMER_ACCEPTED;

      await service.decline(user, 'renewal-1', 'Changed mind');

      expect(transaction.stage).toBe(PolicyTransactionStage.APPLIED);
      expect(repositories.get(PolicyTransaction)!.save).not.toHaveBeenCalled();
    });

    it.each([
      RenewalLifecycleStatus.RENEWED,
      RenewalLifecycleStatus.CUSTOMER_DECLINED,
      RenewalLifecycleStatus.LAPSED,
      RenewalLifecycleStatus.CANCELLED,
    ])('rejects declining a %s renewal', async (status) => {
      renewal.renewal_status = status;

      await expect(
        service.decline(user, 'renewal-1', 'reason'),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(repositories.get(PolicyRenewal)!.save).not.toHaveBeenCalled();
    });
  });

  describe('sendOffer', () => {
    it('sends an offer from OFFER_DRAFT', async () => {
      renewal.renewal_status = RenewalLifecycleStatus.OFFER_DRAFT;

      const result = await service.sendOffer(user, 'renewal-1');

      expect(result.renewal_status).toBe(RenewalLifecycleStatus.OFFER_SENT);
      expect(result.offer_expires_at).toBeInstanceOf(Date);
    });

    it.each([
      RenewalLifecycleStatus.ELIGIBLE,
      RenewalLifecycleStatus.CUSTOMER_ACCEPTED,
      RenewalLifecycleStatus.RENEWED,
      RenewalLifecycleStatus.CUSTOMER_DECLINED,
    ])('rejects sending an offer from %s', async (status) => {
      renewal.renewal_status = status;

      await expect(service.sendOffer(user, 'renewal-1')).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'RENEWAL_INVALID_STATUS' }),
      });
    });
  });

  describe('accept', () => {
    it('accepts a sent offer', async () => {
      const result = await service.accept(user, 'renewal-1');

      expect(result.renewal_status).toBe(
        RenewalLifecycleStatus.CUSTOMER_ACCEPTED,
      );
    });

    it.each([
      RenewalLifecycleStatus.ELIGIBLE,
      RenewalLifecycleStatus.RENEWED,
      RenewalLifecycleStatus.CUSTOMER_DECLINED,
      RenewalLifecycleStatus.LAPSED,
    ])('rejects accepting a %s renewal', async (status) => {
      renewal.renewal_status = status;

      await expect(service.accept(user, 'renewal-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('rejects accepting an expired offer', async () => {
      renewal.offer_expires_at = new Date(Date.now() - 60_000);

      await expect(service.accept(user, 'renewal-1')).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'RENEWAL_OFFER_EXPIRED' }),
      });
    });
  });

  describe('expireLapsedRenewals', () => {
    it('expires the renewal transaction and releases the source policy', async () => {
      await service.expireLapsedRenewals();

      expect(renewal.renewal_status).toBe(RenewalLifecycleStatus.LAPSED);
      expect(transaction.stage).toBe(PolicyTransactionStage.EXPIRED);
      expect(repositories.get(Policy)!.update).toHaveBeenCalledWith(
        expect.objectContaining({ pending_transaction_id: 'txn-1' }),
        { pending_transaction_id: null },
      );
      expect(
        repositories.get(PolicyTransactionEvent)!.save,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: PolicyTransactionEventType.EXPIRED,
          actor_type: 'SYSTEM',
          to_stage: PolicyTransactionStage.EXPIRED,
        }),
      );
    });
  });

  describe('applyIssuedPolicyIfRenewal', () => {
    it('records the stage the transaction actually left', async () => {
      const newPolicy = {
        id: 'policy-2',
        quotation_id: 'quotation-2',
        issued_by_system: true,
        tira_status: 'SUCCESS',
        active_version_id: null,
      } as unknown as Policy;
      const lockedRenewal = { ...renewal, renewed_policy_id: null };
      const renewalQuery = {
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOneOrFail: jest.fn(async () => lockedRenewal),
      };
      const policyQuery = {
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOneOrFail: jest.fn(async () => sourcePolicy),
      };
      repositories.get(PolicyRenewal)!.createQueryBuilder = jest.fn(
        () => renewalQuery,
      );
      repositories.get(Policy)!.createQueryBuilder = jest.fn(() => policyQuery);
      repositories.get(Policy)!.findOneOrFail = jest.fn(async () => newPolicy);

      await service.applyIssuedPolicyIfRenewal(newPolicy);

      expect(
        repositories.get(PolicyTransactionEvent)!.save,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: PolicyTransactionEventType.RENEWAL_POLICY_ISSUED,
          from_stage: PolicyTransactionStage.DRAFT,
          to_stage: PolicyTransactionStage.APPLIED,
        }),
      );
    });
  });
});
