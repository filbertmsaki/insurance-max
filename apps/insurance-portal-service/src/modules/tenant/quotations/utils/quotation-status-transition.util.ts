import {
  BadRequestException,
  ConflictException,
} from '@nestjs/common';

import { QuotationStatus } from '../enums/quotation-status.enum';
import { QuotationStatusTransitionAction } from '../enums/quotation-status-transition-action.enum';

export const EDITABLE_QUOTATION_STATUSES: QuotationStatus[] = [
  QuotationStatus.DRAFT,
  QuotationStatus.PENDING_REQUIREMENTS,
  QuotationStatus.READY_FOR_SUBMISSION,
  QuotationStatus.FAILED,
  QuotationStatus.REJECTED,
];

export const TERMINAL_QUOTATION_STATUSES: QuotationStatus[] = [
  QuotationStatus.COMPLETED,
  QuotationStatus.FAILED,
  QuotationStatus.CANCELLED,
  QuotationStatus.EXPIRED,
  QuotationStatus.REJECTED,
];

const QUOTATION_TRANSITION_MAP: Record<
  QuotationStatus,
  Partial<Record<QuotationStatusTransitionAction, QuotationStatus>>
> = {
  [QuotationStatus.DRAFT]: {
    [QuotationStatusTransitionAction.EVALUATE_REQUIREMENTS]:
      QuotationStatus.PENDING_REQUIREMENTS,
    [QuotationStatusTransitionAction.CANCEL]: QuotationStatus.CANCELLED,
    [QuotationStatusTransitionAction.EXPIRE]: QuotationStatus.EXPIRED,
  },
  [QuotationStatus.PENDING_REQUIREMENTS]: {
    [QuotationStatusTransitionAction.EVALUATE_REQUIREMENTS]:
      QuotationStatus.READY_FOR_SUBMISSION,
    [QuotationStatusTransitionAction.REQUEST_CHANGES]: QuotationStatus.DRAFT,
    [QuotationStatusTransitionAction.REJECT_APPROVAL]: QuotationStatus.REJECTED,
    [QuotationStatusTransitionAction.CANCEL]: QuotationStatus.CANCELLED,
    [QuotationStatusTransitionAction.EXPIRE]: QuotationStatus.EXPIRED,
  },
  [QuotationStatus.READY_FOR_SUBMISSION]: {
    [QuotationStatusTransitionAction.CANCEL]: QuotationStatus.CANCELLED,
    [QuotationStatusTransitionAction.EXPIRE]: QuotationStatus.EXPIRED,
    [QuotationStatusTransitionAction.CONVERT]: QuotationStatus.COMPLETED,
  },
  [QuotationStatus.SUBMITTING_TO_TIRA]: {},
  [QuotationStatus.SUBMITTED_TO_TIRA]: {},
  [QuotationStatus.TIRA_PROCESSING]: {},
  [QuotationStatus.COMPLETED]: {},
  [QuotationStatus.REJECTED]: {},
  [QuotationStatus.FAILED]: {
    [QuotationStatusTransitionAction.EVALUATE_REQUIREMENTS]:
      QuotationStatus.PENDING_REQUIREMENTS,
  },
  [QuotationStatus.CANCELLED]: {},
  [QuotationStatus.EXPIRED]: {},
};

export function resolveQuotationStatusTransition(params: {
  currentStatus: QuotationStatus;
  action: QuotationStatusTransitionAction;
}): QuotationStatus {
  const nextStatus =
    QUOTATION_TRANSITION_MAP[params.currentStatus]?.[params.action];

  if (!nextStatus) {
    throw new ConflictException(
      `Quotation in ${params.currentStatus} status cannot perform ${params.action}`,
    );
  }

  return nextStatus;
}

export function assertQuotationStatusTransition(params: {
  currentStatus: QuotationStatus;
  action: QuotationStatusTransitionAction;
  reason?: string | null;
}) {
  const nextStatus = resolveQuotationStatusTransition(params);
  const trimmedReason = params.reason?.trim() ?? '';

  const requiresReason = [
    QuotationStatusTransitionAction.REQUEST_CHANGES,
    QuotationStatusTransitionAction.REJECT_APPROVAL,
    QuotationStatusTransitionAction.CANCEL,
    QuotationStatusTransitionAction.EXPIRE,
  ].includes(params.action);

  if (requiresReason && !trimmedReason) {
    throw new BadRequestException(
      `A reason is required to ${params.action.toLowerCase().replace(/_/g, ' ')}`,
    );
  }

  return nextStatus;
}
