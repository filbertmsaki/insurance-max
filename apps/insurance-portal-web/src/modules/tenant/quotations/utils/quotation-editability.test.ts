import { describe, expect, it } from 'vitest';
import { canEditQuotation } from './quotation-editability';
import type { QuotationListItem } from '../types';

function quotation(
  overrides: Partial<QuotationListItem> = {},
): Pick<
  QuotationListItem,
  | 'quotation_status'
  | 'tira_status'
  | 'submitted_at'
  | 'source_policy_transaction_id'
> {
  return {
    quotation_status: 'DRAFT',
    tira_status: 'NOT_SUBMITTED',
    submitted_at: null,
    source_policy_transaction_id: null,
    ...overrides,
  };
}

describe('canEditQuotation', () => {
  it.each(['DRAFT', 'PENDING_REQUIREMENTS', 'READY_FOR_SUBMISSION'] as const)(
    'allows unsubmitted %s quotations',
    (status) => {
      expect(canEditQuotation(quotation({ quotation_status: status }))).toBe(
        true,
      );
    },
  );

  it.each(['FAILED', 'REJECTED'] as const)(
    'allows submitted TIRAMIS %s corrections',
    (tira_status) => {
      expect(
        canEditQuotation(
          quotation({
            quotation_status: tira_status,
            tira_status,
            submitted_at: '2026-10-01T00:00:00.000Z',
          }),
        ),
      ).toBe(true);
    },
  );

  it.each([
    ['SUBMITTING_TO_TIRA', 'SUBMITTING'],
    ['SUBMITTED_TO_TIRA', 'SUBMITTED'],
    ['TIRA_PROCESSING', 'PROCESSING'],
    ['COMPLETED', 'SUCCESS'],
    ['COMPLETED', 'ENDORSED'],
    ['CANCELLED', 'CANCELLED'],
    ['EXPIRED', 'NOT_SUBMITTED'],
  ] as const)('blocks %s / %s', (quotation_status, tira_status) => {
    expect(
      canEditQuotation(
        quotation({ quotation_status, tira_status, submitted_at: 'sent' }),
      ),
    ).toBe(false);
  });

  it('blocks policy transaction quotations', () => {
    expect(
      canEditQuotation(
        quotation({ source_policy_transaction_id: 'transaction-1' }),
      ),
    ).toBe(false);
  });

  it('blocks an editable quotation status paired with a successful TIRAMIS result', () => {
    expect(canEditQuotation(quotation({ tira_status: 'SUCCESS' }))).toBe(false);
  });
});
