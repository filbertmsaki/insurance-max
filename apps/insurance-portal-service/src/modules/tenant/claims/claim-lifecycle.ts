import { ClaimQueue, ClaimStage, ClaimStatus } from './enums/claim.enums';

const S = ClaimStatus;

/**
 * Allowed lifecycle edges (docs/claims-module-design.md §4). Anything not
 * listed is rejected by ClaimStateMachineService, so users cannot skip a
 * mandatory stage.
 */
export const CLAIM_STATUS_TRANSITIONS: Readonly<
  Record<ClaimStatus, readonly ClaimStatus[]>
> = {
  [S.DRAFT]: [S.NOTIFICATION_SUBMITTED, S.CANCELLED],
  [S.NOTIFICATION_SUBMITTED]: [S.NOTIFICATION_ACCEPTED, S.NOTIFICATION_FAILED],
  [S.NOTIFICATION_FAILED]: [S.NOTIFICATION_SUBMITTED, S.CANCELLED],
  [S.NOTIFICATION_ACCEPTED]: [S.INTIMATION_PENDING, S.REJECTION_PENDING],
  [S.INTIMATION_PENDING]: [S.INTIMATION_SUBMITTED, S.REJECTION_PENDING],
  [S.INTIMATION_SUBMITTED]: [S.INTIMATED, S.INTIMATION_FAILED],
  [S.INTIMATION_FAILED]: [
    S.INTIMATION_PENDING,
    S.INTIMATION_SUBMITTED,
    S.REJECTION_PENDING,
  ],
  [S.INTIMATED]: [
    S.ASSESSMENT_PENDING,
    S.UNDER_ASSESSMENT,
    S.REJECTION_PENDING,
  ],
  [S.ASSESSMENT_PENDING]: [S.UNDER_ASSESSMENT, S.REJECTION_PENDING],
  [S.UNDER_ASSESSMENT]: [S.ASSESSED, S.REJECTION_PENDING],
  [S.ASSESSED]: [S.PENDING_APPROVAL, S.UNDER_ASSESSMENT, S.REJECTION_PENDING],
  [S.REASSESSMENT_REQUIRED]: [S.UNDER_ASSESSMENT, S.REJECTION_PENDING],
  [S.PENDING_APPROVAL]: [
    S.APPROVED,
    S.REASSESSMENT_REQUIRED,
    S.REJECTION_PENDING,
  ],
  [S.APPROVED]: [
    S.DISCHARGE_PENDING,
    S.REASSESSMENT_REQUIRED,
    S.REJECTION_PENDING,
  ],
  [S.DISCHARGE_PENDING]: [S.DISCHARGE_ISSUED, S.APPROVED],
  [S.DISCHARGE_ISSUED]: [S.DISCHARGE_ACCEPTED, S.DISCHARGE_REJECTED],
  [S.DISCHARGE_REJECTED]: [
    S.DISCHARGE_PENDING,
    S.REASSESSMENT_REQUIRED,
    S.REJECTION_PENDING,
  ],
  [S.DISCHARGE_ACCEPTED]: [S.PAYMENT_PENDING],
  [S.PAYMENT_PENDING]: [S.PARTIALLY_PAID, S.PAID, S.DISCHARGE_ACCEPTED],
  [S.PARTIALLY_PAID]: [S.PAYMENT_PENDING, S.PAID],
  [S.PAID]: [S.SETTLED, S.PARTIALLY_PAID],
  [S.SETTLED]: [S.CLOSED],
  [S.REJECTION_PENDING]: [S.REJECTED],
  [S.REJECTED]: [S.CLOSED],
  [S.CLOSED]: [S.REOPENED],
  [S.REOPENED]: [S.UNDER_ASSESSMENT, S.REJECTION_PENDING],
  [S.CANCELLED]: [],
};

/**
 * Statuses a pending rejection returns to when its approval is declined.
 * Rejection is recorded against the status the claim came from.
 */
export const REJECTABLE_STATUSES: readonly ClaimStatus[] = Object.entries(
  CLAIM_STATUS_TRANSITIONS,
)
  .filter(([, targets]) => targets.includes(S.REJECTION_PENDING))
  .map(([status]) => status as ClaimStatus);

export function canTransition(from: ClaimStatus, to: ClaimStatus): boolean {
  return CLAIM_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

/** `claim_stage` is derived from status and never written independently. */
export function deriveClaimStage(status: ClaimStatus): ClaimStage {
  switch (status) {
    case S.DRAFT:
    case S.NOTIFICATION_SUBMITTED:
    case S.NOTIFICATION_FAILED:
      return ClaimStage.NOTIFICATION_PENDING;
    case S.NOTIFICATION_ACCEPTED:
      return ClaimStage.NOTIFIED;
    case S.INTIMATION_PENDING:
    case S.INTIMATION_SUBMITTED:
    case S.INTIMATION_FAILED:
      return ClaimStage.INTIMATION_PENDING;
    case S.INTIMATED:
      return ClaimStage.INTIMATED;
    case S.ASSESSMENT_PENDING:
    case S.UNDER_ASSESSMENT:
    case S.ASSESSED:
    case S.REASSESSMENT_REQUIRED:
    case S.REOPENED:
      return ClaimStage.ASSESSMENT;
    case S.PENDING_APPROVAL:
    case S.REJECTION_PENDING:
      return ClaimStage.DECISION;
    case S.APPROVED:
    case S.DISCHARGE_PENDING:
    case S.DISCHARGE_ISSUED:
    case S.DISCHARGE_ACCEPTED:
    case S.DISCHARGE_REJECTED:
    case S.PAYMENT_PENDING:
    case S.PARTIALLY_PAID:
    case S.PAID:
    case S.SETTLED:
      return ClaimStage.SETTLEMENT;
    case S.REJECTED:
    case S.CLOSED:
      return ClaimStage.CLOSED;
    case S.CANCELLED:
      return ClaimStage.CANCELLED;
  }
}

/** Statuses shown under each stage menu (§3). */
export const CLAIM_QUEUE_STATUSES: Readonly<
  Record<ClaimQueue, readonly ClaimStatus[]>
> = {
  [ClaimQueue.NOTIFICATION]: [
    S.DRAFT,
    S.NOTIFICATION_SUBMITTED,
    S.NOTIFICATION_FAILED,
  ],
  [ClaimQueue.INTIMATION]: [
    S.NOTIFICATION_ACCEPTED,
    S.INTIMATION_PENDING,
    S.INTIMATION_SUBMITTED,
    S.INTIMATION_FAILED,
  ],
  [ClaimQueue.ASSESSMENT]: [
    S.INTIMATED,
    S.ASSESSMENT_PENDING,
    S.UNDER_ASSESSMENT,
    S.ASSESSED,
    S.REASSESSMENT_REQUIRED,
    S.PENDING_APPROVAL,
    S.REOPENED,
  ],
  [ClaimQueue.DISCHARGE]: [
    S.APPROVED,
    S.DISCHARGE_PENDING,
    S.DISCHARGE_ISSUED,
    S.DISCHARGE_REJECTED,
  ],
  [ClaimQueue.PAYMENT]: [
    S.DISCHARGE_ACCEPTED,
    S.PAYMENT_PENDING,
    S.PARTIALLY_PAID,
    S.PAID,
  ],
  [ClaimQueue.REJECTION]: [S.REJECTION_PENDING, S.REJECTED],
};

export const OPEN_CLAIM_STATUSES: readonly ClaimStatus[] = Object.values(
  S,
).filter(
  (status) => ![S.SETTLED, S.REJECTED, S.CLOSED, S.CANCELLED].includes(status),
);

/** Claims in these states may still be edited as drafts. */
export const EDITABLE_CLAIM_STATUSES: readonly ClaimStatus[] = [
  S.DRAFT,
  S.NOTIFICATION_FAILED,
];
