import { describe, expect, it } from 'vitest';
import type { QuotationPreviewHistoryItem } from '../types';
import { groupHistory, toHistoryEvent } from '../utils/quotationHistory';
import { buildQuotationLifecycle } from '../utils/quotationLifecycle';
import {
  formatDateTime,
  humanizeCode,
  isEmptyDisplay,
} from '../utils/quotationFormat';
import { quotationDetailFixture } from './quotationDetailFixture';

const item = (
  over: Partial<QuotationPreviewHistoryItem>,
): QuotationPreviewHistoryItem => ({
  action: 'TIRAMIS_SUBMISSION_COMPLETED',
  previous_status: 'COMPLETED',
  new_status: 'COMPLETED',
  performed_by: null,
  date_time: '2026-11-09T11:33:00.000Z',
  remarks: null,
  ...over,
});

describe('quotation history mapping', () => {
  it('shows System for automated events, says TIRA and drops no-op transitions', () => {
    const event = toHistoryEvent(item({}));
    expect(event.actor).toBe('System');
    expect(event.title).toBe('TIRA submission completed');
    expect(event.transition).toBeNull();
    expect(event.kind).toBe('success');
  });

  it('groups consecutive duplicates newest first without changing the input', () => {
    const history = [
      item({ date_time: '2026-11-09T10:00:00Z' }),
      item({ date_time: '2026-11-09T10:01:00Z' }),
      item({ date_time: '2026-11-09T10:02:00Z' }),
      item({
        action: 'QUOTATION_CREATED',
        previous_status: null,
        new_status: 'DRAFT',
        performed_by: 'Jane Doe',
        date_time: '2026-11-09T09:00:00Z',
      }),
    ];
    const snapshot = JSON.stringify(history);
    const groups = groupHistory(history);
    expect(groups).toHaveLength(2);
    expect(groups[0].count).toBe(3);
    expect(groups[0].latest.dateTime).toBe('2026-11-09T10:02:00Z');
    expect(groups[1].latest.actor).toBe('Jane Doe');
    expect(JSON.stringify(history)).toBe(snapshot);
  });

  it('classifies failures and filters them', () => {
    const history = [
      item({
        action: 'TIRAMIS_SUBMISSION_FAILED',
        remarks:
          'Tiramis submission failed: The current organizational context is not ready for TIRA submission',
      }),
      item({ action: 'QUOTATION_UPDATED', performed_by: 'Jane Doe' }),
    ];
    const errors = groupHistory(history, 'errors');
    expect(errors).toHaveLength(1);
    expect(errors[0].latest.kind).toBe('failure');
    expect(errors[0].latest.remarks).toMatch(/^TIRA submission failed/);
    expect(groupHistory(history, 'user')).toHaveLength(1);
    expect(groupHistory(history, 'system')).toHaveLength(1);
  });
});

describe('quotation lifecycle', () => {
  it('marks every step done once the policy exists', () => {
    const preview = quotationDetailFixture();
    preview.overview.quotation_status = 'COMPLETED';
    preview.overview.payment_status = 'PAID';
    preview.overview.requires_payment = true;
    preview.overview.tira_status = 'SUCCESS';
    const lifecycle = buildQuotationLifecycle(preview, { hasPolicy: true });
    expect(lifecycle.steps.every((step) => step.state === 'done')).toBe(true);
    expect(lifecycle.overall.label).toBe('Policy issued');
  });

  it('shows a failed TIRA submission with its error', () => {
    const preview = quotationDetailFixture();
    preview.overview.quotation_status = 'FAILED';
    preview.overview.payment_status = 'PAID';
    preview.overview.tira_status = 'FAILED';
    preview.tiramis = {
      ...preview.tiramis!,
      last_submission_error: 'Context not ready',
    };
    const lifecycle = buildQuotationLifecycle(preview, { hasPolicy: false });
    const failed = lifecycle.steps.find((step) => step.state === 'failed');
    expect(failed?.key).toBe('submitted');
    expect(failed?.error).toBe('Context not ready');
    expect(lifecycle.overall.tone).toBe('danger');
  });

  it('leaves the policy step out when policies cannot be read', () => {
    const preview = quotationDetailFixture();
    const lifecycle = buildQuotationLifecycle(preview);
    expect(lifecycle.steps.some((step) => step.key === 'policy')).toBe(false);
  });
});

describe('display formatting', () => {
  it('formats consistently and treats N/A and zero amounts as empty', () => {
    expect(formatDateTime('2026-11-09T14:33:00')).toBe('9 Nov 2026, 2:33 PM');
    expect(humanizeCode('SUBMITTED_TO_TIRAMIS')).toBe('Submitted to TIRA');
    expect(isEmptyDisplay('N/A')).toBe(true);
    expect(isEmptyDisplay('TSh 0.00')).toBe(true);
    expect(isEmptyDisplay('TSh 23,600.00')).toBe(false);
  });
});
