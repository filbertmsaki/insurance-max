import { ForbiddenException, ConflictException } from '@nestjs/common';
import {
  PolicyTransactionPremiumEffect,
  PolicyTransactionStage,
  WorkflowApprovalStatus,
  WorkflowPaymentStatus,
  WorkflowSubmissionStatus,
} from '@insurance-max/contracts';
import { PolicyTransactionLifecycleService } from './policy-transaction-lifecycle.service';

function makeTransaction(overrides: Record<string, unknown> = {}) {
  return {
    id: 'txn-1',
    company_id: 'company-1',
    requested_by: 'maker-user',
    stage: PolicyTransactionStage.DRAFT,
    approval_status: WorkflowApprovalStatus.NOT_EVALUATED,
    payment_status: WorkflowPaymentStatus.NOT_EVALUATED,
    submission_status: WorkflowSubmissionStatus.NOT_READY,
    approval_required: false,
    payment_required: false,
    premium_effect: PolicyTransactionPremiumEffect.NONE,
    state_version: 1,
    ...overrides,
  } as any;
}

function makeHarness(transaction: any) {
  const transactionRepo = {
    save: jest
      .fn()
      .mockImplementation(async (value) => Object.assign(transaction, value)),
    createQueryBuilder: jest.fn().mockReturnValue({
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(transaction),
    }),
  };
  const eventRepo = {
    save: jest.fn().mockResolvedValue(undefined),
  };

  const manager = {
    getRepository: (entity: any) =>
      entity?.name === 'PolicyTransactionEvent' ? eventRepo : transactionRepo,
  };

  const dataSource = {
    transaction: jest.fn().mockImplementation(async (fn: any) => fn(manager)),
  } as any;

  const service = new PolicyTransactionLifecycleService(
    dataSource,
    transactionRepo as any,
    eventRepo as any,
  );

  return { service, transactionRepo, eventRepo };
}

describe('PolicyTransactionLifecycleService', () => {
  describe('approveTransaction', () => {
    it('rejects the maker approving their own transaction', async () => {
      const transaction = makeTransaction({
        approval_status: WorkflowApprovalStatus.PENDING,
      });
      const { service } = makeHarness(transaction);

      await expect(
        service.approveTransaction('company-1', 'txn-1', {
          changedBy: 'maker-user',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('allows a different checker to approve', async () => {
      const transaction = makeTransaction({
        approval_status: WorkflowApprovalStatus.PENDING,
      });
      const { service } = makeHarness(transaction);

      const result = await service.approveTransaction('company-1', 'txn-1', {
        changedBy: 'checker-user',
      });

      expect(result.approval_status).toBe(WorkflowApprovalStatus.APPROVED);
    });

    it('rejects approval from a non-PENDING state', async () => {
      const transaction = makeTransaction({
        approval_status: WorkflowApprovalStatus.APPROVED,
      });
      const { service } = makeHarness(transaction);

      await expect(
        service.approveTransaction('company-1', 'txn-1', {
          changedBy: 'checker-user',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('canSubmit', () => {
    const service = new PolicyTransactionLifecycleService(
      {} as any,
      {} as any,
      {} as any,
    );

    it('requires PAID for a debit transaction before submission', () => {
      const eligible = service.canSubmit(
        makeTransaction({
          stage: PolicyTransactionStage.COMPLETED,
          payment_required: true,
          premium_effect: PolicyTransactionPremiumEffect.DEBIT,
          payment_status: WorkflowPaymentStatus.REQUESTED,
        }),
      );

      expect(eligible).toBe(false);
    });

    it('does not gate a credit transaction on payment', () => {
      const eligible = service.canSubmit(
        makeTransaction({
          stage: PolicyTransactionStage.COMPLETED,
          payment_required: true,
          premium_effect: PolicyTransactionPremiumEffect.CREDIT,
          payment_status: WorkflowPaymentStatus.NOT_REQUESTED,
          submission_status: WorkflowSubmissionStatus.READY,
        }),
      );

      expect(eligible).toBe(true);
    });

    it('is submittable once a debit payment is PAID', () => {
      const eligible = service.canSubmit(
        makeTransaction({
          stage: PolicyTransactionStage.COMPLETED,
          payment_required: true,
          premium_effect: PolicyTransactionPremiumEffect.DEBIT,
          payment_status: WorkflowPaymentStatus.PAID,
          submission_status: WorkflowSubmissionStatus.READY,
        }),
      );

      expect(eligible).toBe(true);
    });
  });
});
