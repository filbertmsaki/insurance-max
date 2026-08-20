import { createHash } from 'node:crypto';

import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import {
  WorkflowApprovalStatus,
  WorkflowPaymentStatus,
  QuotationStage as WorkflowQuotationStage,
  WorkflowSubmissionStatus,
} from '@insurance-max/contracts';
import { Quotation } from '../entities/quotation.entity';
import { QuotationStatusHistory } from '../entities/quotation-status-history.entity';
import { ApprovalStatus } from '../enums/approval-status.enum';
import { PaymentStatus } from '../enums/payment-status.enum';
import { QuotationStatus } from '../enums/quotation-status.enum';
import { TiraStatus } from '../enums/tira-status.enum';

export interface QuotationLifecycleRequirements {
  requiresApproval: boolean;
  requiresPayment: boolean;
}

export interface QuotationLifecycleContext {
  changedBy?: string | null;
  changedByType?: string | null;
  source?: string | null;
  channel?: string | null;
  reason?: string | null;
  comments?: string | null;
  requestId?: string | null;
  paymentTransactionId?: string | null;
  tiraRequestId?: string | null;
  tiraResponseId?: string | null;
  metadata?: Record<string, unknown> | null;
}

interface QuotationLifecycleSnapshot {
  status: QuotationStatus;
  approval_status: ApprovalStatus;
  payment_status: PaymentStatus;
  tira_status: TiraStatus;
}

const DIRECT_PAYMENT_MODE = 1;

@Injectable()
export class QuotationLifecycleService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Quotation)
    private readonly quotationRepository: Repository<Quotation>,
    @InjectRepository(QuotationStatusHistory)
    private readonly quotationStatusHistoryRepository: Repository<QuotationStatusHistory>,
  ) {}

  initializeForCreation(params: {
    paymentMode?: number | null;
    existingApprovalRequired?: boolean;
  }): Pick<
    Quotation,
    | 'requires_approval'
    | 'requires_payment'
    | 'quotation_stage'
    | 'approval_status_v2'
    | 'payment_status_v2'
    | 'submission_status_v2'
    | 'workflow_revision'
    | 'state_version'
    | 'finalization_snapshot'
    | 'finalization_hash'
    | 'workflow_gate_hash'
    | 'workflow_completed_at'
    | 'approval_status'
    | 'payment_status'
    | 'tira_status'
    | 'status'
  > {
    const requiresApproval = Boolean(params.existingApprovalRequired);
    const requiresPayment =
      params.paymentMode != null &&
      Number(params.paymentMode) !== DIRECT_PAYMENT_MODE;

    return {
      requires_approval: requiresApproval,
      requires_payment: requiresPayment,
      quotation_stage: WorkflowQuotationStage.DRAFT,
      approval_status_v2: requiresApproval
        ? WorkflowApprovalStatus.NOT_EVALUATED
        : WorkflowApprovalStatus.NOT_REQUIRED,
      payment_status_v2: requiresPayment
        ? WorkflowPaymentStatus.NOT_REQUESTED
        : WorkflowPaymentStatus.NOT_REQUIRED,
      submission_status_v2: WorkflowSubmissionStatus.NOT_READY,
      workflow_revision: 1,
      state_version: 1,
      finalization_snapshot: null,
      finalization_hash: null,
      workflow_gate_hash: null,
      workflow_completed_at: null,
      approval_status: requiresApproval
        ? ApprovalStatus.NOT_SUBMITTED
        : ApprovalStatus.NOT_REQUIRED,
      payment_status: requiresPayment
        ? PaymentStatus.NOT_INITIATED
        : PaymentStatus.NOT_REQUIRED,
      tira_status: TiraStatus.NOT_SUBMITTED,
      status: QuotationStatus.DRAFT,
    };
  }

  async recordWorkflowFinalization(params: {
    companyId: string;
    quotationId: string;
    finalizationSnapshot: Record<string, unknown>;
    finalizationHash: string;
    workflowGateHash: string;
    completedAt?: Date | null;
    changedBy?: string | null;
  }) {
    return this.withLockedQuotation(
      params.companyId,
      params.quotationId,
      async (manager, quotation) => {
        quotation.finalization_snapshot = params.finalizationSnapshot;
        quotation.finalization_hash = params.finalizationHash;
        quotation.workflow_gate_hash = params.workflowGateHash;
        quotation.workflow_completed_at =
          params.completedAt ?? quotation.workflow_completed_at ?? new Date();
        quotation.updated_by = params.changedBy ?? quotation.updated_by;
        quotation.workflow_revision =
          Number(quotation.workflow_revision ?? 0) + 1;
        quotation.state_version = Number(quotation.state_version ?? 0) + 1;
        return manager.getRepository(Quotation).save(quotation);
      },
    );
  }

  async evaluateRequirements(
    companyId: string,
    quotationId: string,
    context: QuotationLifecycleContext = {},
  ) {
    return this.withLockedQuotation(
      companyId,
      quotationId,
      async (manager, quotation) => {
        if (this.isTerminalQuotationStatus(quotation.status)) {
          return quotation;
        }

        const previous = this.snapshot(quotation);
        this.applyRequirementStatus(quotation);
        return this.persistTransition(
          manager,
          quotation,
          previous,
          'EVALUATE_REQUIREMENTS',
          context,
        );
      },
    );
  }

  async submitForApproval(
    companyId: string,
    quotationId: string,
    context: QuotationLifecycleContext = {},
  ) {
    return this.withLockedQuotation(
      companyId,
      quotationId,
      async (manager, quotation) => {
        if (!quotation.requires_approval) {
          throw new ConflictException(
            'Approval is not required for this quotation',
          );
        }

        if (
          ![
            ApprovalStatus.NOT_SUBMITTED,
            ApprovalStatus.CHANGES_REQUESTED,
          ].includes(quotation.approval_status)
        ) {
          throw new ConflictException(
            `Approval cannot be submitted from ${quotation.approval_status}`,
          );
        }

        const previous = this.snapshot(quotation);
        quotation.approval_status = ApprovalStatus.PENDING;
        quotation.approval_submitted_by = context.changedBy ?? null;
        quotation.approval_submitted_at = new Date();
        quotation.approval_comments =
          context.comments ?? context.reason ?? null;
        quotation.approval_reason = null;
        quotation.status = QuotationStatus.PENDING_REQUIREMENTS;

        return this.persistTransition(
          manager,
          quotation,
          previous,
          'SUBMIT_FOR_APPROVAL',
          context,
        );
      },
    );
  }

  async approveQuotation(
    companyId: string,
    quotationId: string,
    context: QuotationLifecycleContext = {},
  ) {
    return this.withLockedQuotation(
      companyId,
      quotationId,
      async (manager, quotation) => {
        if (!quotation.requires_approval) {
          throw new ConflictException(
            'Approval is not required for this quotation',
          );
        }

        if (quotation.approval_status !== ApprovalStatus.PENDING) {
          throw new ConflictException(
            `Approval cannot be completed from ${quotation.approval_status}`,
          );
        }

        const previous = this.snapshot(quotation);
        quotation.approval_status = ApprovalStatus.APPROVED;
        quotation.approval_decided_by = context.changedBy ?? null;
        quotation.approval_decided_at = new Date();
        quotation.approval_comments =
          context.comments ?? context.reason ?? null;
        quotation.approval_reason = null;
        this.applyRequirementStatus(quotation);

        return this.persistTransition(
          manager,
          quotation,
          previous,
          'APPROVE',
          context,
        );
      },
    );
  }

  async requestChanges(
    companyId: string,
    quotationId: string,
    context: QuotationLifecycleContext = {},
  ) {
    return this.withLockedQuotation(
      companyId,
      quotationId,
      async (manager, quotation) => {
        if (!quotation.requires_approval) {
          throw new ConflictException(
            'Approval is not required for this quotation',
          );
        }

        if (quotation.approval_status !== ApprovalStatus.PENDING) {
          throw new ConflictException(
            `Changes cannot be requested from ${quotation.approval_status}`,
          );
        }

        const previous = this.snapshot(quotation);
        quotation.approval_status = ApprovalStatus.CHANGES_REQUESTED;
        quotation.approval_decided_by = context.changedBy ?? null;
        quotation.approval_decided_at = new Date();
        quotation.approval_comments = context.comments ?? null;
        quotation.approval_reason = context.reason ?? null;
        quotation.status = QuotationStatus.DRAFT;

        return this.persistTransition(
          manager,
          quotation,
          previous,
          'REQUEST_CHANGES',
          context,
        );
      },
    );
  }

  async rejectApproval(
    companyId: string,
    quotationId: string,
    context: QuotationLifecycleContext = {},
  ) {
    return this.withLockedQuotation(
      companyId,
      quotationId,
      async (manager, quotation) => {
        if (!quotation.requires_approval) {
          throw new ConflictException(
            'Approval is not required for this quotation',
          );
        }

        if (quotation.approval_status !== ApprovalStatus.PENDING) {
          throw new ConflictException(
            `Approval cannot be rejected from ${quotation.approval_status}`,
          );
        }

        const previous = this.snapshot(quotation);
        quotation.approval_status = ApprovalStatus.REJECTED;
        quotation.approval_decided_by = context.changedBy ?? null;
        quotation.approval_decided_at = new Date();
        quotation.approval_comments = context.comments ?? null;
        quotation.approval_reason = context.reason ?? null;
        quotation.status = QuotationStatus.REJECTED;
        quotation.rejection_reason =
          context.reason ?? quotation.rejection_reason;

        return this.persistTransition(
          manager,
          quotation,
          previous,
          'REJECT_APPROVAL',
          context,
        );
      },
    );
  }

  async markPaymentRequested(
    companyId: string,
    quotationId: string,
    context: QuotationLifecycleContext = {},
  ) {
    return this.updatePaymentStatus(
      companyId,
      quotationId,
      PaymentStatus.REQUESTED,
      'MARK_PAYMENT_REQUESTED',
      context,
      (quotation) => {
        quotation.payment_requested_at = new Date();
        quotation.payment_request_reference =
          context.paymentTransactionId ?? context.requestId ?? null;
      },
    );
  }

  async markPaymentProcessing(
    companyId: string,
    quotationId: string,
    context: QuotationLifecycleContext = {},
  ) {
    return this.updatePaymentStatus(
      companyId,
      quotationId,
      PaymentStatus.PROCESSING,
      'MARK_PAYMENT_PROCESSING',
      context,
    );
  }

  async markPartiallyPaid(
    companyId: string,
    quotationId: string,
    context: QuotationLifecycleContext = {},
  ) {
    return this.updatePaymentStatus(
      companyId,
      quotationId,
      PaymentStatus.PARTIALLY_PAID,
      'MARK_PARTIALLY_PAID',
      context,
    );
  }

  async markPaymentPaid(
    companyId: string,
    quotationId: string,
    context: QuotationLifecycleContext = {},
  ) {
    return this.updatePaymentStatus(
      companyId,
      quotationId,
      PaymentStatus.PAID,
      'MARK_PAYMENT_PAID',
      context,
      (quotation) => {
        quotation.payment_completed_at = new Date();
        quotation.payment_failure_reason = null;
      },
    );
  }

  async markPaymentFailed(
    companyId: string,
    quotationId: string,
    context: QuotationLifecycleContext = {},
  ) {
    return this.updatePaymentStatus(
      companyId,
      quotationId,
      PaymentStatus.FAILED,
      'MARK_PAYMENT_FAILED',
      context,
      (quotation) => {
        quotation.payment_failure_reason = context.reason ?? null;
      },
    );
  }

  async markPaymentExpired(
    companyId: string,
    quotationId: string,
    context: QuotationLifecycleContext = {},
  ) {
    return this.updatePaymentStatus(
      companyId,
      quotationId,
      PaymentStatus.EXPIRED,
      'MARK_PAYMENT_EXPIRED',
      context,
    );
  }

  async markPaymentRefunded(
    companyId: string,
    quotationId: string,
    context: QuotationLifecycleContext = {},
  ) {
    return this.updatePaymentStatus(
      companyId,
      quotationId,
      PaymentStatus.REFUNDED,
      'MARK_PAYMENT_REFUNDED',
      context,
    );
  }

  async startTiraSubmission(
    companyId: string,
    quotationId: string,
    context: QuotationLifecycleContext = {},
    options: { allowRetryFromFailure?: boolean } = {},
  ) {
    return this.withLockedQuotation(
      companyId,
      quotationId,
      async (manager, quotation) => {
        const canRetryFromFailure =
          options.allowRetryFromFailure &&
          this.canRetryTiraSubmission(quotation);

        if (!this.canSubmitToTira(quotation) && !canRetryFromFailure) {
          throw new ConflictException(
            'Quotation is not ready for TIRAMIS submission',
          );
        }

        const previous = this.snapshot(quotation);
        quotation.status = QuotationStatus.SUBMITTING_TO_TIRA;
        quotation.tira_status = TiraStatus.SUBMITTING;
        quotation.submitted_by = context.changedBy ?? quotation.submitted_by;
        quotation.submitted_at = quotation.submitted_at ?? new Date();

        return this.persistTransition(
          manager,
          quotation,
          previous,
          'START_TIRA_SUBMISSION',
          context,
        );
      },
    );
  }

  async markTiraSubmitted(
    companyId: string,
    quotationId: string,
    context: QuotationLifecycleContext = {},
  ) {
    return this.withLockedQuotation(
      companyId,
      quotationId,
      async (manager, quotation) => {
        if (
          [
            TiraStatus.SUBMITTED,
            TiraStatus.PROCESSING,
            TiraStatus.SUCCESS,
            TiraStatus.REJECTED,
          ].includes(quotation.tira_status)
        ) {
          return quotation;
        }

        if (
          quotation.status === QuotationStatus.CANCELLED ||
          quotation.status === QuotationStatus.EXPIRED
        ) {
          return quotation;
        }

        const previous = this.snapshot(quotation);
        quotation.status = QuotationStatus.SUBMITTED_TO_TIRA;
        quotation.tira_status = TiraStatus.SUBMITTED;
        quotation.tira_request_id =
          context.tiraRequestId ??
          context.requestId ??
          quotation.tira_request_id;
        quotation.tira_response_id =
          context.tiraResponseId ?? quotation.tira_response_id;
        quotation.tira_response_code =
          typeof context.metadata?.statusCode === 'string'
            ? context.metadata.statusCode
            : quotation.tira_response_code;
        quotation.tira_response_description =
          context.reason ?? quotation.tira_response_description;

        return this.persistTransition(
          manager,
          quotation,
          previous,
          'MARK_TIRA_SUBMITTED',
          context,
        );
      },
    );
  }

  async markTiraProcessing(
    companyId: string,
    quotationId: string,
    context: QuotationLifecycleContext = {},
  ) {
    return this.withLockedQuotation(
      companyId,
      quotationId,
      async (manager, quotation) => {
        if (
          [
            TiraStatus.PROCESSING,
            TiraStatus.SUCCESS,
            TiraStatus.REJECTED,
            TiraStatus.FAILED,
          ].includes(quotation.tira_status)
        ) {
          return quotation;
        }

        if (
          quotation.status === QuotationStatus.CANCELLED ||
          quotation.status === QuotationStatus.EXPIRED ||
          quotation.status === QuotationStatus.REJECTED ||
          quotation.status === QuotationStatus.COMPLETED
        ) {
          return quotation;
        }

        const previous = this.snapshot(quotation);
        quotation.status = QuotationStatus.TIRA_PROCESSING;
        quotation.tira_status = TiraStatus.PROCESSING;
        quotation.tira_request_id =
          context.tiraRequestId ??
          context.requestId ??
          quotation.tira_request_id;
        quotation.tira_response_id =
          context.tiraResponseId ?? quotation.tira_response_id;

        return this.persistTransition(
          manager,
          quotation,
          previous,
          'MARK_TIRA_PROCESSING',
          context,
        );
      },
    );
  }

  async markTiraAcknowledged(
    companyId: string,
    quotationId: string,
    context: QuotationLifecycleContext = {},
  ) {
    return this.withLockedQuotation(
      companyId,
      quotationId,
      async (manager, quotation) => {
        if (
          quotation.tira_status === TiraStatus.SUCCESS ||
          quotation.tira_status === TiraStatus.REJECTED
        ) {
          return quotation;
        }

        if (
          quotation.status === QuotationStatus.CANCELLED ||
          quotation.status === QuotationStatus.EXPIRED
        ) {
          return quotation;
        }

        const previous = this.snapshot(quotation);
        quotation.status = QuotationStatus.COMPLETED;
        quotation.tira_status = TiraStatus.SUBMITTED;
        this.applyTiraMetadata(quotation, context);

        return this.persistTransition(
          manager,
          quotation,
          previous,
          'MARK_TIRA_ACKNOWLEDGED',
          context,
        );
      },
    );
  }

  async markTiraSuccessful(
    companyId: string,
    quotationId: string,
    context: QuotationLifecycleContext = {},
  ) {
    return this.withLockedQuotation(
      companyId,
      quotationId,
      async (manager, quotation) => {
        if (quotation.tira_status === TiraStatus.SUCCESS) {
          return quotation;
        }

        if (
          quotation.status === QuotationStatus.CANCELLED ||
          quotation.status === QuotationStatus.EXPIRED ||
          quotation.tira_status === TiraStatus.REJECTED
        ) {
          return quotation;
        }

        const previous = this.snapshot(quotation);
        quotation.status = QuotationStatus.COMPLETED;
        quotation.tira_status = TiraStatus.SUCCESS;
        this.applyTiraMetadata(quotation, context);

        return this.persistTransition(
          manager,
          quotation,
          previous,
          'MARK_TIRA_SUCCESSFUL',
          context,
        );
      },
    );
  }

  async markTiraCancelled(
    companyId: string,
    quotationId: string,
    context: QuotationLifecycleContext = {},
  ) {
    return this.withLockedQuotation(
      companyId,
      quotationId,
      async (manager, quotation) => {
        if (
          quotation.status === QuotationStatus.CANCELLED &&
          quotation.tira_status === TiraStatus.SUCCESS
        ) {
          return quotation;
        }

        if (
          quotation.status === QuotationStatus.EXPIRED ||
          quotation.status === QuotationStatus.REJECTED ||
          quotation.tira_status === TiraStatus.REJECTED
        ) {
          return quotation;
        }

        const previous = this.snapshot(quotation);
        quotation.status = QuotationStatus.CANCELLED;
        quotation.tira_status = TiraStatus.SUCCESS;
        this.applyTiraMetadata(quotation, context);

        return this.persistTransition(
          manager,
          quotation,
          previous,
          'MARK_TIRA_CANCELLED',
          context,
        );
      },
    );
  }

  async markTiraRejected(
    companyId: string,
    quotationId: string,
    context: QuotationLifecycleContext = {},
  ) {
    return this.withLockedQuotation(
      companyId,
      quotationId,
      async (manager, quotation) => {
        if (quotation.tira_status === TiraStatus.REJECTED) {
          return quotation;
        }

        if (
          quotation.status === QuotationStatus.CANCELLED ||
          quotation.status === QuotationStatus.EXPIRED ||
          quotation.status === QuotationStatus.COMPLETED ||
          quotation.tira_status === TiraStatus.SUCCESS
        ) {
          return quotation;
        }

        const previous = this.snapshot(quotation);
        quotation.status = QuotationStatus.REJECTED;
        quotation.tira_status = TiraStatus.REJECTED;
        this.applyTiraMetadata(quotation, context);
        quotation.rejection_reason =
          context.reason ?? quotation.rejection_reason;

        return this.persistTransition(
          manager,
          quotation,
          previous,
          'MARK_TIRA_REJECTED',
          context,
        );
      },
    );
  }

  async markTiraFailed(
    companyId: string,
    quotationId: string,
    context: QuotationLifecycleContext = {},
  ) {
    return this.withLockedQuotation(
      companyId,
      quotationId,
      async (manager, quotation) => {
        if (quotation.tira_status === TiraStatus.FAILED) {
          return quotation;
        }

        if (
          quotation.status === QuotationStatus.CANCELLED ||
          quotation.status === QuotationStatus.EXPIRED ||
          quotation.status === QuotationStatus.COMPLETED ||
          quotation.status === QuotationStatus.REJECTED ||
          quotation.tira_status === TiraStatus.SUCCESS ||
          quotation.tira_status === TiraStatus.REJECTED
        ) {
          return quotation;
        }

        const previous = this.snapshot(quotation);
        quotation.status = QuotationStatus.FAILED;
        quotation.tira_status = TiraStatus.FAILED;
        this.applyTiraMetadata(quotation, context);

        return this.persistTransition(
          manager,
          quotation,
          previous,
          'MARK_TIRA_FAILED',
          context,
        );
      },
    );
  }

  async cancelQuotation(
    companyId: string,
    quotationId: string,
    context: QuotationLifecycleContext = {},
  ) {
    return this.withLockedQuotation(
      companyId,
      quotationId,
      async (manager, quotation) => {
        if (this.isTerminalQuotationStatus(quotation.status)) {
          throw new ConflictException(
            `Quotation cannot be cancelled from ${quotation.status}`,
          );
        }

        if (quotation.tira_status !== TiraStatus.NOT_SUBMITTED) {
          throw new ConflictException(
            'Quotation cannot be cancelled after TIRAMIS submission has started',
          );
        }

        const previous = this.snapshot(quotation);
        quotation.status = QuotationStatus.CANCELLED;
        if (quotation.requires_approval) {
          quotation.approval_status = ApprovalStatus.CANCELLED;
        }
        if (
          quotation.requires_payment &&
          quotation.payment_status !== PaymentStatus.PAID
        ) {
          quotation.payment_status = PaymentStatus.CANCELLED;
        }

        return this.persistTransition(
          manager,
          quotation,
          previous,
          'CANCEL',
          context,
        );
      },
    );
  }

  async expireQuotation(
    companyId: string,
    quotationId: string,
    context: QuotationLifecycleContext = {},
  ) {
    return this.withLockedQuotation(
      companyId,
      quotationId,
      async (manager, quotation) => {
        if (this.isTerminalQuotationStatus(quotation.status)) {
          throw new ConflictException(
            `Quotation cannot be expired from ${quotation.status}`,
          );
        }

        if (quotation.tira_status !== TiraStatus.NOT_SUBMITTED) {
          throw new ConflictException(
            'Quotation cannot be expired after TIRAMIS submission has started',
          );
        }

        const previous = this.snapshot(quotation);
        quotation.status = QuotationStatus.EXPIRED;
        if (
          quotation.requires_payment &&
          quotation.payment_status !== PaymentStatus.PAID
        ) {
          quotation.payment_status = PaymentStatus.EXPIRED;
        }

        return this.persistTransition(
          manager,
          quotation,
          previous,
          'EXPIRE',
          context,
        );
      },
    );
  }

  async convertQuotation(
    companyId: string,
    quotationId: string,
    context: QuotationLifecycleContext = {},
  ) {
    return this.withLockedQuotation(
      companyId,
      quotationId,
      async (manager, quotation) => {
        const previous = this.snapshot(quotation);
        quotation.status = QuotationStatus.COMPLETED;

        return this.persistTransition(
          manager,
          quotation,
          previous,
          'CONVERT',
          context,
        );
      },
    );
  }

  canSubmitToTira(
    quotation: Pick<
      Quotation,
      | 'status'
      | 'approval_status'
      | 'payment_status'
      | 'tira_status'
      | 'requires_approval'
      | 'requires_payment'
    >,
  ) {
    return (
      quotation.status === QuotationStatus.READY_FOR_SUBMISSION &&
      quotation.tira_status === TiraStatus.NOT_SUBMITTED &&
      (!quotation.requires_approval ||
        quotation.approval_status === ApprovalStatus.APPROVED) &&
      (!quotation.requires_payment ||
        quotation.payment_status === PaymentStatus.PAID)
    );
  }

  private canRetryTiraSubmission(
    quotation: Pick<
      Quotation,
      | 'status'
      | 'approval_status'
      | 'payment_status'
      | 'tira_status'
      | 'requires_approval'
      | 'requires_payment'
    >,
  ) {
    return (
      quotation.status === QuotationStatus.FAILED &&
      quotation.tira_status === TiraStatus.FAILED &&
      (!quotation.requires_approval ||
        quotation.approval_status === ApprovalStatus.APPROVED) &&
      (!quotation.requires_payment ||
        quotation.payment_status === PaymentStatus.PAID)
    );
  }

  private async updatePaymentStatus(
    companyId: string,
    quotationId: string,
    nextStatus: PaymentStatus,
    transitionType: string,
    context: QuotationLifecycleContext,
    afterUpdate?: (quotation: Quotation) => void,
  ) {
    return this.withLockedQuotation(
      companyId,
      quotationId,
      async (manager, quotation) => {
        if (!quotation.requires_payment) {
          throw new ConflictException(
            'Payment is not required for this quotation',
          );
        }

        if (quotation.payment_status === nextStatus) {
          return quotation;
        }

        if (
          [
            QuotationStatus.CANCELLED,
            QuotationStatus.EXPIRED,
            QuotationStatus.REJECTED,
          ].includes(quotation.status)
        ) {
          throw new ConflictException(
            `Payment cannot be updated while quotation is ${quotation.status}`,
          );
        }

        const previous = this.snapshot(quotation);
        quotation.payment_status = nextStatus;
        afterUpdate?.(quotation);
        this.applyRequirementStatus(quotation);

        return this.persistTransition(
          manager,
          quotation,
          previous,
          transitionType,
          context,
        );
      },
    );
  }

  private applyRequirementStatus(quotation: Quotation) {
    if (quotation.approval_status === ApprovalStatus.CHANGES_REQUESTED) {
      quotation.status = QuotationStatus.DRAFT;
      return;
    }

    if (quotation.approval_status === ApprovalStatus.REJECTED) {
      quotation.status = QuotationStatus.REJECTED;
      return;
    }

    if (quotation.tira_status === TiraStatus.SUCCESS) {
      quotation.status = QuotationStatus.COMPLETED;
      return;
    }

    if (quotation.tira_status === TiraStatus.REJECTED) {
      quotation.status = QuotationStatus.REJECTED;
      return;
    }

    if (quotation.tira_status === TiraStatus.FAILED) {
      quotation.status = QuotationStatus.FAILED;
      return;
    }

    const approvalSatisfied =
      !quotation.requires_approval ||
      quotation.approval_status === ApprovalStatus.APPROVED;
    const paymentSatisfied =
      !quotation.requires_payment ||
      quotation.payment_status === PaymentStatus.PAID;

    quotation.status =
      approvalSatisfied && paymentSatisfied
        ? QuotationStatus.READY_FOR_SUBMISSION
        : QuotationStatus.PENDING_REQUIREMENTS;
  }

  private applyTiraMetadata(
    quotation: Quotation,
    context: QuotationLifecycleContext,
  ) {
    quotation.tira_request_id =
      context.tiraRequestId ?? context.requestId ?? quotation.tira_request_id;
    quotation.tira_response_id =
      context.tiraResponseId ?? quotation.tira_response_id;
    quotation.tira_response_code =
      typeof context.metadata?.statusCode === 'string'
        ? context.metadata.statusCode
        : quotation.tira_response_code;
    quotation.tira_response_description =
      context.reason ??
      (typeof context.metadata?.statusDescription === 'string'
        ? context.metadata.statusDescription
        : quotation.tira_response_description);
    quotation.tira_error_details =
      context.metadata ?? quotation.tira_error_details;
  }

  private async withLockedQuotation(
    companyId: string,
    quotationId: string,
    handler: (
      manager: EntityManager,
      quotation: Quotation,
    ) => Promise<Quotation>,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const quotation = await manager
        .getRepository(Quotation)
        .createQueryBuilder('quotation')
        .setLock('pessimistic_write')
        .where('quotation.id = :quotationId', { quotationId })
        .andWhere('quotation.company_id = :companyId', { companyId })
        .andWhere('quotation.deleted_at IS NULL')
        .getOne();

      if (!quotation) {
        throw new NotFoundException('Quotation not found');
      }

      return handler(manager, quotation);
    });
  }

  private async persistTransition(
    manager: EntityManager,
    quotation: Quotation,
    previous: QuotationLifecycleSnapshot,
    transitionType: string,
    context: QuotationLifecycleContext,
  ) {
    if (this.isSameSnapshot(previous, quotation)) {
      return quotation;
    }

    this.applyWorkflowProjection(quotation, { incrementVersion: true });
    quotation.updated_by = context.changedBy ?? quotation.updated_by;
    await manager.getRepository(Quotation).save(quotation);

    await manager.getRepository(QuotationStatusHistory).save({
      quotation_id: quotation.id,
      previous_quotation_status: previous.status,
      new_quotation_status: quotation.status,
      previous_approval_status: previous.approval_status,
      new_approval_status: quotation.approval_status,
      previous_payment_status: previous.payment_status,
      new_payment_status: quotation.payment_status,
      previous_tira_status: previous.tira_status,
      new_tira_status: quotation.tira_status,
      transition_type: transitionType,
      reason: context.reason ?? null,
      comments: context.comments ?? null,
      changed_by: context.changedBy ?? null,
      changed_by_type: context.changedByType ?? 'USER',
      source: context.source ?? 'SYSTEM',
      channel: context.channel ?? null,
      request_id: context.requestId ?? null,
      payment_transaction_id: context.paymentTransactionId ?? null,
      tira_request_id: context.tiraRequestId ?? context.requestId ?? null,
      tira_response_id: context.tiraResponseId ?? null,
      metadata: context.metadata ?? null,
    });

    return quotation;
  }

  private snapshot(
    quotation: Pick<
      Quotation,
      'status' | 'approval_status' | 'payment_status' | 'tira_status'
    >,
  ): QuotationLifecycleSnapshot {
    return {
      status: quotation.status,
      approval_status: quotation.approval_status,
      payment_status: quotation.payment_status,
      tira_status: quotation.tira_status,
    };
  }

  private isSameSnapshot(
    previous: QuotationLifecycleSnapshot,
    quotation: Pick<
      Quotation,
      'status' | 'approval_status' | 'payment_status' | 'tira_status'
    >,
  ) {
    return (
      previous.status === quotation.status &&
      previous.approval_status === quotation.approval_status &&
      previous.payment_status === quotation.payment_status &&
      previous.tira_status === quotation.tira_status
    );
  }

  private isTerminalQuotationStatus(status: QuotationStatus) {
    return [
      QuotationStatus.COMPLETED,
      QuotationStatus.REJECTED,
      QuotationStatus.FAILED,
      QuotationStatus.CANCELLED,
      QuotationStatus.EXPIRED,
    ].includes(status);
  }

  private applyWorkflowProjection(
    quotation: Quotation,
    options: { incrementVersion?: boolean } = {},
  ) {
    quotation.quotation_stage = this.resolveWorkflowStage(quotation);
    quotation.approval_status_v2 =
      this.resolveWorkflowApprovalStatus(quotation);
    quotation.payment_status_v2 = this.resolveWorkflowPaymentStatus(quotation);
    quotation.submission_status_v2 =
      this.resolveWorkflowSubmissionStatus(quotation);

    if (quotation.finalization_snapshot && !quotation.finalization_hash) {
      quotation.finalization_hash = this.hashDefinition(
        quotation.finalization_snapshot,
      );
    }

    if (quotation.quotation_stage === WorkflowQuotationStage.DRAFT) {
      quotation.workflow_completed_at = null;
    } else if (
      !quotation.workflow_completed_at &&
      (quotation.quotation_stage === WorkflowQuotationStage.COMPLETED ||
        quotation.quotation_stage ===
          WorkflowQuotationStage.SUBMISSION_PROCESSING ||
        quotation.quotation_stage === WorkflowQuotationStage.SUBMITTED)
    ) {
      quotation.workflow_completed_at = new Date();
    }

    quotation.workflow_gate_hash = this.hashDefinition({
      quotationStage: quotation.quotation_stage,
      approvalStatus: quotation.approval_status_v2,
      paymentStatus: quotation.payment_status_v2,
      submissionStatus: quotation.submission_status_v2,
      approvalRequired: quotation.requires_approval,
      paymentRequired: quotation.requires_payment,
      finalizationHash: quotation.finalization_hash,
      completedAt: quotation.workflow_completed_at?.toISOString() ?? null,
    });

    if (options.incrementVersion) {
      quotation.workflow_revision =
        Number(quotation.workflow_revision ?? 0) + 1;
      quotation.state_version = Number(quotation.state_version ?? 0) + 1;
    }
  }

  private resolveWorkflowStage(quotation: Quotation) {
    if (quotation.status === QuotationStatus.CANCELLED) {
      return WorkflowQuotationStage.CANCELLED;
    }

    if (quotation.status === QuotationStatus.EXPIRED) {
      return WorkflowQuotationStage.EXPIRED;
    }

    if (
      quotation.status === QuotationStatus.SUBMITTING_TO_TIRA ||
      quotation.status === QuotationStatus.TIRA_PROCESSING ||
      quotation.tira_status === TiraStatus.SUBMITTING ||
      quotation.tira_status === TiraStatus.PROCESSING
    ) {
      return WorkflowQuotationStage.SUBMISSION_PROCESSING;
    }

    if (
      quotation.status === QuotationStatus.SUBMITTED_TO_TIRA ||
      quotation.tira_status === TiraStatus.SUBMITTED ||
      quotation.tira_status === TiraStatus.SUCCESS
    ) {
      return WorkflowQuotationStage.SUBMITTED;
    }

    if (quotation.status === QuotationStatus.READY_FOR_SUBMISSION) {
      return WorkflowQuotationStage.COMPLETED;
    }

    return WorkflowQuotationStage.DRAFT;
  }

  private resolveWorkflowApprovalStatus(quotation: Quotation) {
    switch (quotation.approval_status) {
      case ApprovalStatus.NOT_REQUIRED:
        return WorkflowApprovalStatus.NOT_REQUIRED;
      case ApprovalStatus.PENDING:
        return WorkflowApprovalStatus.PENDING;
      case ApprovalStatus.APPROVED:
        return WorkflowApprovalStatus.APPROVED;
      case ApprovalStatus.CHANGES_REQUESTED:
        return WorkflowApprovalStatus.CHANGES_REQUESTED;
      case ApprovalStatus.REJECTED:
        return WorkflowApprovalStatus.REJECTED;
      case ApprovalStatus.CANCELLED:
        return WorkflowApprovalStatus.CANCELLED;
      case ApprovalStatus.NOT_SUBMITTED:
      default:
        return quotation.requires_approval
          ? WorkflowApprovalStatus.NOT_EVALUATED
          : WorkflowApprovalStatus.NOT_REQUIRED;
    }
  }

  private resolveWorkflowPaymentStatus(quotation: Quotation) {
    switch (quotation.payment_status) {
      case PaymentStatus.NOT_REQUIRED:
        return WorkflowPaymentStatus.NOT_REQUIRED;
      case PaymentStatus.REQUESTED:
        return WorkflowPaymentStatus.REQUESTED;
      case PaymentStatus.PROCESSING:
        return WorkflowPaymentStatus.PROCESSING;
      case PaymentStatus.PARTIALLY_PAID:
        return WorkflowPaymentStatus.PARTIAL;
      case PaymentStatus.PAID:
        return WorkflowPaymentStatus.PAID;
      case PaymentStatus.FAILED:
      case PaymentStatus.EXPIRED:
        return WorkflowPaymentStatus.FAILED;
      case PaymentStatus.REFUNDED:
        return WorkflowPaymentStatus.REFUNDED;
      case PaymentStatus.CANCELLED:
        return WorkflowPaymentStatus.CANCELLED;
      case PaymentStatus.NOT_INITIATED:
      default:
        return quotation.requires_payment
          ? WorkflowPaymentStatus.NOT_REQUESTED
          : WorkflowPaymentStatus.NOT_REQUIRED;
    }
  }

  private resolveWorkflowSubmissionStatus(quotation: Quotation) {
    switch (quotation.tira_status) {
      case TiraStatus.SUBMITTING:
      case TiraStatus.PROCESSING:
        return WorkflowSubmissionStatus.PROCESSING;
      case TiraStatus.SUBMITTED:
        return WorkflowSubmissionStatus.ACKNOWLEDGED;
      case TiraStatus.SUCCESS:
        return WorkflowSubmissionStatus.ACCEPTED;
      case TiraStatus.REJECTED:
        return WorkflowSubmissionStatus.REJECTED;
      case TiraStatus.FAILED:
        return this.canRetryTiraSubmission(quotation)
          ? WorkflowSubmissionStatus.RETRYABLE
          : WorkflowSubmissionStatus.FAILED;
      case TiraStatus.NOT_SUBMITTED:
      default:
        return quotation.status === QuotationStatus.READY_FOR_SUBMISSION
          ? WorkflowSubmissionStatus.READY
          : WorkflowSubmissionStatus.NOT_READY;
    }
  }

  private hashDefinition(value: unknown): string {
    return createHash('sha256')
      .update(JSON.stringify(this.sortValue(value)), 'utf8')
      .digest('hex');
  }

  private sortValue(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.sortValue(item));
    }

    if (value && typeof value === 'object') {
      return Object.keys(value)
        .sort()
        .reduce<Record<string, unknown>>((result, key) => {
          result[key] = this.sortValue((value as Record<string, unknown>)[key]);
          return result;
        }, {});
    }

    if (typeof value === 'string') {
      return value.trim().replace(/\r\n/g, '\n');
    }

    return value;
  }
}
