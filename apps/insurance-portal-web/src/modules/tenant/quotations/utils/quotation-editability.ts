import type { QuotationListItem, QuotationStatus, TiraStatus } from '../types';

const EDITABLE_QUOTATION_STATUSES = new Set<QuotationStatus>([
  'DRAFT',
  'PENDING_REQUIREMENTS',
  'READY_FOR_SUBMISSION',
  'REJECTED',
  'FAILED',
]);

const CORRECTION_TIRA_STATUSES = new Set<TiraStatus>(['REJECTED', 'FAILED']);

export function canEditQuotation(
  quotation: Pick<
    QuotationListItem,
    | 'quotation_status'
    | 'tira_status'
    | 'submitted_at'
    | 'source_policy_transaction_id'
  >,
): boolean {
  if (quotation.source_policy_transaction_id) return false;
  if (!EDITABLE_QUOTATION_STATUSES.has(quotation.quotation_status))
    return false;

  const isTiraCorrection = CORRECTION_TIRA_STATUSES.has(quotation.tira_status);
  if (quotation.tira_status !== 'NOT_SUBMITTED' && !isTiraCorrection) {
    return false;
  }

  // A failed or rejected TIRAMIS response can be corrected even when the
  // quotation's legacy status has not yet been synchronized.
  return !quotation.submitted_at || isTiraCorrection;
}
