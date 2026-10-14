import type { QuotationListItem } from '../types';

export function canEditQuotation(
  quotation: Pick<
    QuotationListItem,
    | 'quotation_status'
    | 'tira_status'
    | 'submitted_at'
    | 'source_policy_transaction_id'
  >,
): boolean {
  return (
    !quotation.source_policy_transaction_id &&
    (quotation.quotation_status !== 'COMPLETED' ||
      quotation.tira_status === 'FAILED') &&
    quotation.quotation_status !== 'CANCELLED' &&
    quotation.quotation_status !== 'EXPIRED' &&
    quotation.tira_status !== 'SUCCESS' &&
    quotation.tira_status !== 'CANCELLED' &&
    quotation.tira_status !== 'ENDORSED'
  );
}
