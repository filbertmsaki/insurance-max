import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

/** Legacy permission retained for compatibility with existing callers.
 * Quotation and policy-transaction approvals enforce maker-checker regardless.
 */
export const SELF_APPROVE_PERMISSION = 'approvals:self-approve';

export function canSelfApprove(user: AuthenticatedUser): boolean {
  return (user.permissions ?? []).includes(SELF_APPROVE_PERMISSION);
}
