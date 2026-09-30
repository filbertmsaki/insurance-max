import {
  CLAIM_QUEUE_STATUSES,
  CLAIM_STATUS_TRANSITIONS,
  REJECTABLE_STATUSES,
  canTransition,
  deriveClaimStage,
} from './claim-lifecycle';
import { ClaimQueue, ClaimStage, ClaimStatus } from './enums/claim.enums';

describe('claim lifecycle', () => {
  it('defines transitions for every status', () => {
    for (const status of Object.values(ClaimStatus)) {
      expect(CLAIM_STATUS_TRANSITIONS[status]).toBeDefined();
    }
  });

  it('only targets known statuses', () => {
    const known = new Set(Object.values(ClaimStatus));

    for (const targets of Object.values(CLAIM_STATUS_TRANSITIONS)) {
      for (const target of targets) {
        expect(known.has(target)).toBe(true);
      }
    }
  });

  it('cannot skip mandatory stages', () => {
    expect(canTransition(ClaimStatus.DRAFT, ClaimStatus.NOTIFICATION_ACCEPTED)).toBe(false);
    expect(canTransition(ClaimStatus.DRAFT, ClaimStatus.INTIMATION_PENDING)).toBe(false);
    expect(canTransition(ClaimStatus.NOTIFICATION_ACCEPTED, ClaimStatus.UNDER_ASSESSMENT)).toBe(false);
    expect(canTransition(ClaimStatus.INTIMATED, ClaimStatus.APPROVED)).toBe(false);
    expect(canTransition(ClaimStatus.APPROVED, ClaimStatus.PAYMENT_PENDING)).toBe(false);
    expect(canTransition(ClaimStatus.DISCHARGE_ISSUED, ClaimStatus.PAID)).toBe(false);
    expect(canTransition(ClaimStatus.PARTIALLY_PAID, ClaimStatus.SETTLED)).toBe(false);
  });

  it('follows the happy path from draft to closed', () => {
    const path = [
      ClaimStatus.DRAFT,
      ClaimStatus.NOTIFICATION_SUBMITTED,
      ClaimStatus.NOTIFICATION_ACCEPTED,
      ClaimStatus.INTIMATION_PENDING,
      ClaimStatus.INTIMATION_SUBMITTED,
      ClaimStatus.INTIMATED,
      ClaimStatus.UNDER_ASSESSMENT,
      ClaimStatus.ASSESSED,
      ClaimStatus.PENDING_APPROVAL,
      ClaimStatus.APPROVED,
      ClaimStatus.DISCHARGE_PENDING,
      ClaimStatus.DISCHARGE_ISSUED,
      ClaimStatus.DISCHARGE_ACCEPTED,
      ClaimStatus.PAYMENT_PENDING,
      ClaimStatus.PARTIALLY_PAID,
      ClaimStatus.PAID,
      ClaimStatus.SETTLED,
      ClaimStatus.CLOSED,
    ];

    for (let index = 1; index < path.length; index += 1) {
      expect(canTransition(path[index - 1], path[index])).toBe(true);
    }
  });

  it('supports reassessment and a rejected offer', () => {
    expect(canTransition(ClaimStatus.PENDING_APPROVAL, ClaimStatus.REASSESSMENT_REQUIRED)).toBe(true);
    expect(canTransition(ClaimStatus.REASSESSMENT_REQUIRED, ClaimStatus.UNDER_ASSESSMENT)).toBe(true);
    expect(canTransition(ClaimStatus.DISCHARGE_ISSUED, ClaimStatus.DISCHARGE_REJECTED)).toBe(true);
    expect(canTransition(ClaimStatus.DISCHARGE_REJECTED, ClaimStatus.DISCHARGE_PENDING)).toBe(true);
    expect(canTransition(ClaimStatus.CLOSED, ClaimStatus.REOPENED)).toBe(true);
  });

  it('never allows rejection once money is committed', () => {
    for (const status of [
      ClaimStatus.DISCHARGE_ACCEPTED,
      ClaimStatus.PAYMENT_PENDING,
      ClaimStatus.PARTIALLY_PAID,
      ClaimStatus.PAID,
      ClaimStatus.SETTLED,
    ]) {
      expect(REJECTABLE_STATUSES).not.toContain(status);
    }
  });

  it('keeps cancelled claims terminal', () => {
    expect(CLAIM_STATUS_TRANSITIONS[ClaimStatus.CANCELLED]).toEqual([]);
  });

  it('derives the coarse stage from status', () => {
    expect(deriveClaimStage(ClaimStatus.DRAFT)).toBe(ClaimStage.NOTIFICATION_PENDING);
    expect(deriveClaimStage(ClaimStatus.NOTIFICATION_ACCEPTED)).toBe(ClaimStage.NOTIFIED);
    expect(deriveClaimStage(ClaimStatus.INTIMATED)).toBe(ClaimStage.INTIMATED);
    expect(deriveClaimStage(ClaimStatus.PENDING_APPROVAL)).toBe(ClaimStage.DECISION);
    expect(deriveClaimStage(ClaimStatus.PARTIALLY_PAID)).toBe(ClaimStage.SETTLEMENT);
    expect(deriveClaimStage(ClaimStatus.REJECTED)).toBe(ClaimStage.CLOSED);
  });

  it('places every open status in exactly one stage queue', () => {
    const seen = new Map<ClaimStatus, ClaimQueue>();

    for (const [queue, statuses] of Object.entries(CLAIM_QUEUE_STATUSES)) {
      for (const status of statuses) {
        expect(seen.get(status)).toBeUndefined();
        seen.set(status, queue as ClaimQueue);
      }
    }

    expect(seen.get(ClaimStatus.DRAFT)).toBe(ClaimQueue.NOTIFICATION);
    expect(seen.get(ClaimStatus.PARTIALLY_PAID)).toBe(ClaimQueue.PAYMENT);
  });
});
