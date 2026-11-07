import { describe, expect, it, vi } from 'vitest';
import { UnderwriteLine } from '@insurance-max/contracts';
import type { QuotationDetailRecord } from '@/modules/tenant/quotations/types';
import { buildDuplicateDraft } from '../duplicate';

vi.mock('@/modules/tenant/quotations/schemas', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('@/modules/tenant/quotations/schemas')
  >()),
  // The real mapper is covered by the wizard tests; here we only check what
  // the duplicate builder does with its output.
  quotationRecordToFormValues: () => ({
    customer_id: 'customer-1',
    product_id: 'product-1',
    category_id: 'category-1',
    valid_from: '2020-01-01T00:00:00',
    valid_until: '2020-12-31T23:59:59',
    quotation_flow: 'MOTOR_SINGLE',
  }),
}));

const record = (draft: Record<string, unknown> | null) =>
  ({ id: 'q-1', draft_payload: draft }) as unknown as QuotationDetailRecord;

describe('buildDuplicateDraft (D2)', () => {
  it('copies the business data and pins the line', () => {
    const payload = buildDuplicateDraft(record(null), UnderwriteLine.FLEET);

    expect(payload).toMatchObject({
      customer_id: 'customer-1',
      product_id: 'product-1',
      quotation_flow: 'MOTOR_FLEET',
      is_fleet: true,
      current_wizard_step: 'customer',
    });
  });

  it('starts a fresh cover period instead of copying old dates', () => {
    const payload = buildDuplicateDraft(record(null), UnderwriteLine.MOTOR);
    const values = payload.draft_payload as Record<string, string>;

    expect(values.valid_from.startsWith('2020')).toBe(false);
    expect(payload.current_wizard_step).toBe('details');
  });

  it('does not copy the source status', () => {
    const payload = buildDuplicateDraft(
      record({ status: 'COMPLETED' }),
      UnderwriteLine.MOTOR,
    );

    expect((payload.draft_payload as Record<string, unknown>).status).not.toBe(
      'COMPLETED',
    );
  });
});
