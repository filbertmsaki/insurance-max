import type { QuotationPreviewRecord, QuotationWorkflowView } from '../types';

export const APPROVAL_HISTORY =
  /approv|reject|changes.requested|premium.changed/i;

/**
 * Whether approval deserves its own tab: approval is (or was) required, or
 * the history has approval events. Otherwise the header's approval line is
 * enough.
 */
export function shouldShowApprovalTab(
  preview: QuotationPreviewRecord,
  workflow?: QuotationWorkflowView,
) {
  const status = workflow?.approval.status ?? preview.overview.approval_status;
  return (
    preview.overview.requires_approval ||
    !['NOT_REQUIRED', 'NOT_SUBMITTED', 'NOT_EVALUATED'].includes(status) ||
    preview.history.some((item) => APPROVAL_HISTORY.test(item.action))
  );
}
