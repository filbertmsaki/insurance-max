import {
  assertQuotationStatusTransition,
  resolveQuotationStatusTransition,
} from './quotation-status-transition.util';
import { QuotationStatus } from '../enums/quotation-status.enum';
import { QuotationStatusTransitionAction } from '../enums/quotation-status-transition-action.enum';

describe('quotation status transition util', () => {
  it('maps draft requirement evaluation to pending requirements', () => {
    expect(
      resolveQuotationStatusTransition({
        currentStatus: QuotationStatus.DRAFT,
        action: QuotationStatusTransitionAction.EVALUATE_REQUIREMENTS,
      }),
    ).toBe(QuotationStatus.PENDING_REQUIREMENTS);
  });

  it('rejects invalid transitions', () => {
    expect(() =>
      resolveQuotationStatusTransition({
        currentStatus: QuotationStatus.DRAFT,
        action: QuotationStatusTransitionAction.APPROVE,
      }),
    ).toThrow('Quotation in DRAFT status cannot perform APPROVE');
  });

  it('requires a reason for rejection transitions', () => {
    expect(() =>
      assertQuotationStatusTransition({
        currentStatus: QuotationStatus.PENDING_REQUIREMENTS,
        action: QuotationStatusTransitionAction.REJECT_APPROVAL,
      }),
    ).toThrow('A reason is required to reject approval');
  });

  it('allows ready quotations to convert', () => {
    expect(
      assertQuotationStatusTransition({
        currentStatus: QuotationStatus.READY_FOR_SUBMISSION,
        action: QuotationStatusTransitionAction.CONVERT,
      }),
    ).toBe(QuotationStatus.COMPLETED);
  });

  it('allows pending quotations to request changes', () => {
    expect(
      resolveQuotationStatusTransition({
        currentStatus: QuotationStatus.PENDING_REQUIREMENTS,
        action: QuotationStatusTransitionAction.REQUEST_CHANGES,
      }),
    ).toBe(QuotationStatus.DRAFT);
  });

  it('treats completed quotations as terminal', () => {
    expect(() =>
      resolveQuotationStatusTransition({
        currentStatus: QuotationStatus.COMPLETED,
        action: QuotationStatusTransitionAction.APPROVE,
      }),
    ).toThrow('Quotation in COMPLETED status cannot perform APPROVE');
  });
});
