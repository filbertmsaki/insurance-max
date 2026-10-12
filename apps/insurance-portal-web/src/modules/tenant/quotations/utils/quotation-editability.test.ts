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
  it.each([
    'DRAFT',
    'PENDING_REQUIREMENTS',
    'READY_FOR_SUBMISSION',
    'SUBMITTING_TO_TIRA',
    'SUBMITTED_TO_TIRA',
    'TIRA_PROCESSING',
    'REJECTED',
    'FAILED',
  ] as const)(
    'allows %s quotations before an excluded final status',
    (status) => {
      expect(canEditQuotation(quotation({ quotation_status: status }))).toBe(
        true,
      );
    },
  );

  it.each([
    ['COMPLETED', 'SUCCESS'],
    ['READY_FOR_SUBMISSION', 'SUCCESS'],
    ['COMPLETED', 'ENDORSED'],
    ['FAILED', 'ENDORSED'],
    ['CANCELLED', 'CANCELLED'],
    ['READY_FOR_SUBMISSION', 'CANCELLED'],
    ['READY_FOR_SUBMISSION', 'ENDORSED'],
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

  it('allows a submitted quotation still processing at TIRAMIS', () => {
    expect(
      canEditQuotation(
        quotation({
          quotation_status: 'TIRA_PROCESSING',
          tira_status: 'PROCESSING',
          submitted_at: '2026-10-01T00:00:00.000Z',
        }),
      ),
    ).toBe(true);
  });
});
