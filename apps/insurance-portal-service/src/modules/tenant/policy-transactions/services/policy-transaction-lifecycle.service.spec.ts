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
  const policyRepo = {
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };

  const manager = {
    getRepository: (entity: any) =>
      entity?.name === 'PolicyTransactionEvent'
        ? eventRepo
        : entity?.name === 'Policy'
          ? policyRepo
          : transactionRepo,
  };

  const dataSource = {
    transaction: jest.fn().mockImplementation(async (fn: any) => fn(manager)),
  } as any;

  const service = new PolicyTransactionLifecycleService(
    dataSource,
    transactionRepo as any,
    eventRepo as any,
  );

  return { service, transactionRepo, eventRepo, policyRepo };
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

    it('lets a maker with self-approve rights approve and flags the event', async () => {
      const transaction = makeTransaction({
        approval_status: WorkflowApprovalStatus.PENDING,
      });
      const { service, eventRepo } = makeHarness(transaction);

      const result = await service.approveTransaction('company-1', 'txn-1', {
        changedBy: 'maker-user',
        isMakerCheckerExempt: true,
      });

      expect(result.approval_status).toBe(WorkflowApprovalStatus.APPROVED);
      expect(eventRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: { self_approved: true } }),
      );
    });

    it('allows a different checker to approve without a self-approval flag', async () => {
      const transaction = makeTransaction({
        approval_status: WorkflowApprovalStatus.PENDING,
      });
      const { service, eventRepo } = makeHarness(transaction);

      const result = await service.approveTransaction('company-1', 'txn-1', {
        changedBy: 'checker-user',
      });

      expect(result.approval_status).toBe(WorkflowApprovalStatus.APPROVED);
      expect(eventRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: null }),
      );
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

  describe('releasing the source policy lock', () => {
    const expectedCriteria = {
      id: 'policy-1',
      company_id: 'company-1',
      pending_transaction_id: 'txn-1',
    };

    it('clears pending_transaction_id when an approval is rejected', async () => {
      const transaction = makeTransaction({
        source_policy_id: 'policy-1',
        stage: PolicyTransactionStage.COMPLETED,
        approval_status: WorkflowApprovalStatus.PENDING,
      });
      const { service, policyRepo } = makeHarness(transaction);

      const result = await service.rejectApproval('company-1', 'txn-1', {
        changedBy: 'checker-user',
        reason: 'Not supported',
      });

      expect(result.stage).toBe(PolicyTransactionStage.REJECTED);
      expect(policyRepo.update).toHaveBeenCalledWith(expectedCriteria, {
        pending_transaction_id: null,
      });
    });

    it('clears pending_transaction_id when a transaction is withdrawn', async () => {
      const transaction = makeTransaction({ source_policy_id: 'policy-1' });
      const { service, policyRepo } = makeHarness(transaction);

      const result = await service.cancelTransaction('company-1', 'txn-1', {
        changedBy: 'maker-user',
        reason: 'Customer changed their mind',
      });

      expect(result.stage).toBe(PolicyTransactionStage.CANCELLED);
      expect(policyRepo.update).toHaveBeenCalledWith(expectedCriteria, {
        pending_transaction_id: null,
      });
    });

    it('does not release the policy when changes are requested', async () => {
      const transaction = makeTransaction({
        source_policy_id: 'policy-1',
        stage: PolicyTransactionStage.COMPLETED,
        approval_status: WorkflowApprovalStatus.PENDING,
      });
      const { service, policyRepo } = makeHarness(transaction);

      await service.requestChanges('company-1', 'txn-1', {
        changedBy: 'checker-user',
        reason: 'Fix the effective date',
      });

      expect(policyRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('markSubmissionFailed', () => {
    it('reverts stage from SUBMISSION_PROCESSING back to COMPLETED so the transaction can be resubmitted', async () => {
      const transaction = makeTransaction({
        stage: PolicyTransactionStage.SUBMISSION_PROCESSING,
        approval_status: WorkflowApprovalStatus.APPROVED,
        submission_status: WorkflowSubmissionStatus.PROCESSING,
      });
      const { service } = makeHarness(transaction);

      const result = await service.markSubmissionFailed('company-1', 'txn-1', {
        changedBy: 'system',
        reason: 'TIRAMIS HTTP request failed with status 403',
      });

      expect(result.stage).toBe(PolicyTransactionStage.COMPLETED);
      expect(result.submission_status).toBe(WorkflowSubmissionStatus.FAILED);
      expect(service.canSubmit(result)).toBe(true);
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
