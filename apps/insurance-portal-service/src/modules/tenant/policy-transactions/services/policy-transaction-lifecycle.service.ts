import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import {
  PolicyTransactionEventType,
  PolicyTransactionPremiumEffect,
  PolicyTransactionStage,
  WorkflowApprovalStatus,
  WorkflowPaymentStatus,
  WorkflowSubmissionStatus,
} from '@insurance-max/contracts';

import { PolicyTransaction } from '../entities/policy-transaction.entity';
import { PolicyTransactionEvent } from '../entities/policy-transaction-event.entity';

export interface PolicyTransactionLifecycleContext {
  changedBy?: string | null;
  changedByType?: string | null;
  reason?: string | null;
  comments?: string | null;
  requestId?: string | null;
  tiraRequestId?: string | null;
  tiraResponseId?: string | null;
  metadata?: Record<string, unknown> | null;
}

interface LifecycleSnapshot {
  stage: PolicyTransactionStage;
  approval_status: WorkflowApprovalStatus;
  payment_status: WorkflowPaymentStatus;
  submission_status: WorkflowSubmissionStatus;
}

const TERMINAL_STAGES: PolicyTransactionStage[] = [
  PolicyTransactionStage.APPLIED,
  PolicyTransactionStage.CANCELLED,
  PolicyTransactionStage.EXPIRED,
  PolicyTransactionStage.REJECTED,
];

/**
 * Approval/payment/submission state machine for policy transactions,
 * modeled directly on `QuotationLifecycleService` (Phase 9) since this
 * codebase has no separate pluggable maker-checker module to reuse.
 */
@Injectable()
export class PolicyTransactionLifecycleService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(PolicyTransaction)
    private readonly transactionRepository: Repository<PolicyTransaction>,
    @InjectRepository(PolicyTransactionEvent)
    private readonly eventRepository: Repository<PolicyTransactionEvent>,
  ) {}

  async evaluateRequirements(
    companyId: string,
    transactionId: string,
    context: PolicyTransactionLifecycleContext = {},
  ) {
    return this.withLockedTransaction(
      companyId,
      transactionId,
      async (manager, transaction) => {
        if (this.isTerminal(transaction.stage)) {
          return transaction;
        }

        const previous = this.snapshot(transaction);
        this.applyRequirementStage(transaction);

        return this.persistTransition(
          manager,
          transaction,
          previous,
          PolicyTransactionEventType.COMPLETED,
          context,
        );
      },
    );
  }

  async submitForApproval(
    companyId: string,
    transactionId: string,
    context: PolicyTransactionLifecycleContext = {},
  ) {
    return this.withLockedTransaction(
      companyId,
      transactionId,
      async (manager, transaction) => {
        if (!transaction.approval_required) {
          throw new ConflictException(
            'Approval is not required for this transaction',
          );
        }

        const submittableApprovalStatuses: WorkflowApprovalStatus[] = [
          WorkflowApprovalStatus.NOT_EVALUATED,
          WorkflowApprovalStatus.CHANGES_REQUESTED,
        ];

        if (!submittableApprovalStatuses.includes(transaction.approval_status)) {
          throw new ConflictException(
            `Approval cannot be submitted from ${transaction.approval_status}`,
          );
        }

        const previous = this.snapshot(transaction);
        transaction.approval_status = WorkflowApprovalStatus.PENDING;

        return this.persistTransition(
          manager,
          transaction,
          previous,
          PolicyTransactionEventType.APPROVAL_SUBMITTED,
          context,
        );
      },
    );
  }

  async approveTransaction(
    companyId: string,
    transactionId: string,
    context: PolicyTransactionLifecycleContext = {},
  ) {
    return this.withLockedTransaction(
      companyId,
      transactionId,
      async (manager, transaction) => {
        if (transaction.approval_status !== WorkflowApprovalStatus.PENDING) {
          throw new ConflictException(
            `Approval cannot be completed from ${transaction.approval_status}`,
          );
        }

        if (
          context.changedBy &&
          context.changedBy === transaction.requested_by
        ) {
          throw new ForbiddenException(
            'The maker of a transaction cannot approve it (maker-checker).',
          );
        }

        const previous = this.snapshot(transaction);
        transaction.approval_status = WorkflowApprovalStatus.APPROVED;
        this.applyRequirementStage(transaction);

        return this.persistTransition(
          manager,
          transaction,
          previous,
          PolicyTransactionEventType.APPROVED,
          context,
        );
      },
    );
  }

  async requestChanges(
    companyId: string,
    transactionId: string,
    context: PolicyTransactionLifecycleContext = {},
  ) {
    return this.withLockedTransaction(
      companyId,
      transactionId,
      async (manager, transaction) => {
        if (transaction.approval_status !== WorkflowApprovalStatus.PENDING) {
          throw new ConflictException(
            `Changes cannot be requested from ${transaction.approval_status}`,
          );
        }

        const previous = this.snapshot(transaction);
        transaction.approval_status = WorkflowApprovalStatus.CHANGES_REQUESTED;
        transaction.stage = PolicyTransactionStage.DRAFT;

        return this.persistTransition(
          manager,
          transaction,
          previous,
          PolicyTransactionEventType.CHANGES_REQUESTED,
          context,
        );
      },
    );
  }

  async rejectApproval(
    companyId: string,
    transactionId: string,
    context: PolicyTransactionLifecycleContext = {},
  ) {
    return this.withLockedTransaction(
      companyId,
      transactionId,
      async (manager, transaction) => {
        if (transaction.approval_status !== WorkflowApprovalStatus.PENDING) {
          throw new ConflictException(
            `Approval cannot be rejected from ${transaction.approval_status}`,
          );
        }

        const previous = this.snapshot(transaction);
        transaction.approval_status = WorkflowApprovalStatus.REJECTED;
        transaction.stage = PolicyTransactionStage.REJECTED;

        return this.persistTransition(
          manager,
          transaction,
          previous,
          PolicyTransactionEventType.REJECTED,
          context,
        );
      },
    );
  }

  async markPaymentRequested(
    companyId: string,
    transactionId: string,
    context: PolicyTransactionLifecycleContext = {},
  ) {
    return this.updatePaymentStatus(
      companyId,
      transactionId,
      WorkflowPaymentStatus.REQUESTED,
      PolicyTransactionEventType.PAYMENT_REQUESTED,
      context,
    );
  }

  async markPaymentProcessing(
    companyId: string,
    transactionId: string,
    context: PolicyTransactionLifecycleContext = {},
  ) {
    return this.updatePaymentStatus(
      companyId,
      transactionId,
      WorkflowPaymentStatus.PROCESSING,
      PolicyTransactionEventType.PAYMENT_REQUESTED,
      context,
    );
  }

  async markPaymentPartial(
    companyId: string,
    transactionId: string,
    context: PolicyTransactionLifecycleContext = {},
  ) {
    return this.updatePaymentStatus(
      companyId,
      transactionId,
      WorkflowPaymentStatus.PARTIAL,
      PolicyTransactionEventType.PAYMENT_REQUESTED,
      context,
    );
  }

  async markPaymentPaid(
    companyId: string,
    transactionId: string,
    context: PolicyTransactionLifecycleContext = {},
  ) {
    return this.updatePaymentStatus(
      companyId,
      transactionId,
      WorkflowPaymentStatus.PAID,
      PolicyTransactionEventType.PAYMENT_SATISFIED,
      context,
    );
  }

  async markPaymentFailed(
    companyId: string,
    transactionId: string,
    context: PolicyTransactionLifecycleContext = {},
  ) {
    return this.updatePaymentStatus(
      companyId,
      transactionId,
      WorkflowPaymentStatus.FAILED,
      PolicyTransactionEventType.PAYMENT_REQUESTED,
      context,
    );
  }

  async startSubmission(
    companyId: string,
    transactionId: string,
    context: PolicyTransactionLifecycleContext = {},
  ) {
    return this.withLockedTransaction(
      companyId,
      transactionId,
      async (manager, transaction) => {
        if (!this.canSubmit(transaction)) {
          throw new ConflictException(
            'Transaction is not ready for TIRAMIS submission',
          );
        }

        const previous = this.snapshot(transaction);
        transaction.stage = PolicyTransactionStage.SUBMISSION_PROCESSING;
        transaction.submission_status = WorkflowSubmissionStatus.PROCESSING;

        return this.persistTransition(
          manager,
          transaction,
          previous,
          PolicyTransactionEventType.SUBMISSION_QUEUED,
          context,
        );
      },
    );
  }

  async markSubmissionAccepted(
    companyId: string,
    transactionId: string,
    context: PolicyTransactionLifecycleContext = {},
  ) {
    return this.withLockedTransaction(
      companyId,
      transactionId,
      async (manager, transaction) => {
        if (
          transaction.submission_status === WorkflowSubmissionStatus.ACCEPTED
        ) {
          return transaction;
        }

        const previous = this.snapshot(transaction);
        transaction.submission_status = WorkflowSubmissionStatus.ACCEPTED;

        return this.persistTransition(
          manager,
          transaction,
          previous,
          PolicyTransactionEventType.SUBMISSION_ACCEPTED,
          context,
        );
      },
    );
  }

  async markSubmissionRejected(
    companyId: string,
    transactionId: string,
    context: PolicyTransactionLifecycleContext = {},
  ) {
    return this.withLockedTransaction(
      companyId,
      transactionId,
      async (manager, transaction) => {
        if (this.isTerminal(transaction.stage)) {
          return transaction;
        }

        const previous = this.snapshot(transaction);
        transaction.submission_status = WorkflowSubmissionStatus.REJECTED;
        transaction.stage = PolicyTransactionStage.REJECTED;

        return this.persistTransition(
          manager,
          transaction,
          previous,
          PolicyTransactionEventType.SUBMISSION_REJECTED,
          context,
        );
      },
    );
  }

  async markApplied(
    companyId: string,
    transactionId: string,
    context: PolicyTransactionLifecycleContext = {},
  ) {
    return this.withLockedTransaction(
      companyId,
      transactionId,
      async (manager, transaction) => {
        const previous = this.snapshot(transaction);
        transaction.stage = PolicyTransactionStage.APPLIED;

        return this.persistTransition(
          manager,
          transaction,
          previous,
          PolicyTransactionEventType.POLICY_VERSION_APPLIED,
          context,
        );
      },
    );
  }

  async cancelTransaction(
    companyId: string,
    transactionId: string,
    context: PolicyTransactionLifecycleContext = {},
  ) {
    return this.withLockedTransaction(
      companyId,
      transactionId,
      async (manager, transaction) => {
        if (this.isTerminal(transaction.stage)) {
          throw new ConflictException(
            `Transaction cannot be cancelled from ${transaction.stage}`,
          );
        }

        if (transaction.submission_status === WorkflowSubmissionStatus.PROCESSING) {
          throw new ConflictException(
            'Transaction cannot be cancelled while a TIRAMIS submission is in flight',
          );
        }

        const previous = this.snapshot(transaction);
        transaction.stage = PolicyTransactionStage.CANCELLED;
        transaction.cancelled_by = context.changedBy ?? null;
        transaction.cancelled_at = new Date();
        transaction.cancellation_reason = context.reason ?? null;

        return this.persistTransition(
          manager,
          transaction,
          previous,
          PolicyTransactionEventType.CANCELLED,
          context,
        );
      },
    );
  }

  canSubmit(
    transaction: Pick<
      PolicyTransaction,
      'stage' | 'approval_status' | 'payment_status' | 'submission_status' | 'approval_required' | 'payment_required' | 'premium_effect'
    >,
  ): boolean {
    const approvalSatisfied =
      !transaction.approval_required ||
      transaction.approval_status === WorkflowApprovalStatus.APPROVED;

    // Credit transactions never gate on payment — a refund/credit is only
    // created after regulatory acceptance (§13.14).
    const paymentSatisfied =
      !transaction.payment_required ||
      transaction.premium_effect === PolicyTransactionPremiumEffect.CREDIT ||
      transaction.payment_status === WorkflowPaymentStatus.PAID;

    return (
      transaction.stage === PolicyTransactionStage.COMPLETED &&
      transaction.submission_status !== WorkflowSubmissionStatus.PROCESSING &&
      transaction.submission_status !== WorkflowSubmissionStatus.ACCEPTED &&
      approvalSatisfied &&
      paymentSatisfied
    );
  }

  private async updatePaymentStatus(
    companyId: string,
    transactionId: string,
    nextStatus: WorkflowPaymentStatus,
    eventType: PolicyTransactionEventType,
    context: PolicyTransactionLifecycleContext,
  ) {
    return this.withLockedTransaction(
      companyId,
      transactionId,
      async (manager, transaction) => {
        if (!transaction.payment_required) {
          throw new ConflictException(
            'Payment is not required for this transaction',
          );
        }

        if (transaction.payment_status === nextStatus) {
          return transaction;
        }

        const previous = this.snapshot(transaction);
        transaction.payment_status = nextStatus;
        this.applyRequirementStage(transaction);

        return this.persistTransition(
          manager,
          transaction,
          previous,
          eventType,
          context,
        );
      },
    );
  }

  private applyRequirementStage(transaction: PolicyTransaction) {
    if (this.isTerminal(transaction.stage)) {
      return;
    }

    if (transaction.approval_status === WorkflowApprovalStatus.CHANGES_REQUESTED) {
      transaction.stage = PolicyTransactionStage.DRAFT;
      return;
    }

    if (transaction.approval_status === WorkflowApprovalStatus.REJECTED) {
      transaction.stage = PolicyTransactionStage.REJECTED;
      return;
    }

    transaction.stage = this.canSubmit(transaction)
      ? PolicyTransactionStage.COMPLETED
      : transaction.stage === PolicyTransactionStage.DRAFT
        ? PolicyTransactionStage.COMPLETED
        : transaction.stage;
  }

  private async withLockedTransaction(
    companyId: string,
    transactionId: string,
    handler: (
      manager: EntityManager,
      transaction: PolicyTransaction,
    ) => Promise<PolicyTransaction>,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const transaction = await manager
        .getRepository(PolicyTransaction)
        .createQueryBuilder('transaction')
        .setLock('pessimistic_write')
        .where('transaction.id = :transactionId', { transactionId })
        .andWhere('transaction.company_id = :companyId', { companyId })
        .getOne();

      if (!transaction) {
        throw new NotFoundException('Policy transaction not found');
      }

      return handler(manager, transaction);
    });
  }

  private async persistTransition(
    manager: EntityManager,
    transaction: PolicyTransaction,
    previous: LifecycleSnapshot,
    eventType: PolicyTransactionEventType,
    context: PolicyTransactionLifecycleContext,
  ) {
    if (this.isSameSnapshot(previous, transaction)) {
      return transaction;
    }

    transaction.state_version = Number(transaction.state_version || 1) + 1;
    await manager.getRepository(PolicyTransaction).save(transaction);

    await manager.getRepository(PolicyTransactionEvent).save({
      company_id: transaction.company_id,
      policy_transaction_id: transaction.id,
      event_type: eventType,
      actor_type: context.changedBy ? 'USER' : 'SYSTEM',
      actor_id: context.changedBy ?? null,
      from_stage: previous.stage,
      to_stage: transaction.stage,
      reason: context.reason ?? null,
      metadata: context.metadata ?? null,
      source_event_id: null,
    });

    return transaction;
  }

  private snapshot(transaction: PolicyTransaction): LifecycleSnapshot {
    return {
      stage: transaction.stage,
      approval_status: transaction.approval_status,
      payment_status: transaction.payment_status,
      submission_status: transaction.submission_status,
    };
  }

  private isSameSnapshot(
    previous: LifecycleSnapshot,
    transaction: PolicyTransaction,
  ) {
    return (
      previous.stage === transaction.stage &&
      previous.approval_status === transaction.approval_status &&
      previous.payment_status === transaction.payment_status &&
      previous.submission_status === transaction.submission_status
    );
  }

  private isTerminal(stage: PolicyTransactionStage) {
    return TERMINAL_STAGES.includes(stage);
  }
}
