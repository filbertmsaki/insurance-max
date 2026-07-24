import {
  BadRequestException,
  ConflictException,
} from '@nestjs/common';

import { QuotationStatus } from '../enums/quotation-status.enum';
import { QuotationStatusTransitionAction } from '../enums/quotation-status-transition-action.enum';

export const EDITABLE_QUOTATION_STATUSES: QuotationStatus[] = [
  QuotationStatus.DRAFT,
  QuotationStatus.RATED,
  QuotationStatus.REFERRED,
  QuotationStatus.REJECTED,
];

export const TERMINAL_QUOTATION_STATUSES: QuotationStatus[] = [
  QuotationStatus.CONVERTED,
  QuotationStatus.CANCELLED,
  QuotationStatus.EXPIRED,
];

const QUOTATION_TRANSITION_MAP: Record<
  QuotationStatus,
  Partial<Record<QuotationStatusTransitionAction, QuotationStatus>>
> = {
  [QuotationStatus.DRAFT]: {
    [QuotationStatusTransitionAction.RATE]: QuotationStatus.RATED,
    [QuotationStatusTransitionAction.REFER]: QuotationStatus.REFERRED,
    [QuotationStatusTransitionAction.REQUEST_APPROVAL]:
      QuotationStatus.SUBMITTED_TO_TIRA,
    [QuotationStatusTransitionAction.CANCEL]: QuotationStatus.CANCELLED,
    [QuotationStatusTransitionAction.EXPIRE]: QuotationStatus.EXPIRED,
  },
  [QuotationStatus.RATED]: {
    [QuotationStatusTransitionAction.REFER]: QuotationStatus.REFERRED,
    [QuotationStatusTransitionAction.REQUEST_APPROVAL]:
      QuotationStatus.SUBMITTED_TO_TIRA,
    [QuotationStatusTransitionAction.APPROVE]: QuotationStatus.APPROVED,
    [QuotationStatusTransitionAction.RESET_TO_DRAFT]: QuotationStatus.DRAFT,
  },
  [QuotationStatus.REFERRED]: {
    [QuotationStatusTransitionAction.RESET_TO_DRAFT]: QuotationStatus.DRAFT,
    [QuotationStatusTransitionAction.REQUEST_APPROVAL]:
      QuotationStatus.SUBMITTED_TO_TIRA,
    [QuotationStatusTransitionAction.APPROVE]: QuotationStatus.APPROVED,
    [QuotationStatusTransitionAction.REJECT]: QuotationStatus.REJECTED,
  },
  [QuotationStatus.PENDING_APPROVAL]: {
    [QuotationStatusTransitionAction.REQUEST_APPROVAL]:
      QuotationStatus.SUBMITTED_TO_TIRA,
    [QuotationStatusTransitionAction.APPROVE]: QuotationStatus.APPROVED,
    [QuotationStatusTransitionAction.REJECT]: QuotationStatus.REJECTED,
    [QuotationStatusTransitionAction.CANCEL]: QuotationStatus.CANCELLED,
  },
  [QuotationStatus.SUBMITTED_TO_TIRA]: {
    [QuotationStatusTransitionAction.APPROVE]: QuotationStatus.APPROVED,
    [QuotationStatusTransitionAction.REJECT]: QuotationStatus.REJECTED,
    [QuotationStatusTransitionAction.CANCEL]: QuotationStatus.CANCELLED,
  },
  [QuotationStatus.APPROVED]: {
    [QuotationStatusTransitionAction.REQUEST_APPROVAL]:
      QuotationStatus.SUBMITTED_TO_TIRA,
    [QuotationStatusTransitionAction.CONVERT]: QuotationStatus.CONVERTED,
    [QuotationStatusTransitionAction.EXPIRE]: QuotationStatus.EXPIRED,
    [QuotationStatusTransitionAction.CANCEL]: QuotationStatus.CANCELLED,
  },
  [QuotationStatus.REJECTED]: {
    [QuotationStatusTransitionAction.RESET_TO_DRAFT]: QuotationStatus.DRAFT,
    [QuotationStatusTransitionAction.REQUEST_APPROVAL]:
      QuotationStatus.SUBMITTED_TO_TIRA,
    [QuotationStatusTransitionAction.REFER]: QuotationStatus.REFERRED,
  },
  [QuotationStatus.CONVERTED]: {},
  [QuotationStatus.EXPIRED]: {},
  [QuotationStatus.CANCELLED]: {},
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

  const requiresReason =
    params.action === QuotationStatusTransitionAction.REFER ||
    params.action === QuotationStatusTransitionAction.REJECT ||
    params.action === QuotationStatusTransitionAction.CANCEL ||
    params.action === QuotationStatusTransitionAction.EXPIRE ||
    (params.action === QuotationStatusTransitionAction.APPROVE &&
      params.currentStatus === QuotationStatus.REFERRED);

  if (requiresReason && !trimmedReason) {
    throw new BadRequestException(
      `A reason is required to ${params.action.toLowerCase().replace(/_/g, ' ')}`,
    );
  }

  return nextStatus;
}
