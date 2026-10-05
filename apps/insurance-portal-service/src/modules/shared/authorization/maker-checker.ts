import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

/**
 * Lets the holder approve a quotation, endorsement or cancellation they
 * submitted themselves, bypassing maker-checker. Grant sparingly; every
 * self-approval is flagged on the approval history (`self_approved`).
 */
export const SELF_APPROVE_PERMISSION = 'approvals:self-approve';

export function canSelfApprove(user: AuthenticatedUser): boolean {
  return (user.permissions ?? []).includes(SELF_APPROVE_PERMISSION);
}
