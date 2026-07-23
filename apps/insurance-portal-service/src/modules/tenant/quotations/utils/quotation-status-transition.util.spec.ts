import {
  assertQuotationStatusTransition,
  resolveQuotationStatusTransition,
} from './quotation-status-transition.util';
import { QuotationStatus } from '../enums/quotation-status.enum';
import { QuotationStatusTransitionAction } from '../enums/quotation-status-transition-action.enum';

describe('quotation status transition util', () => {
  it('maps DRAFT request approval to PENDING_APPROVAL', () => {
    expect(
      resolveQuotationStatusTransition({
        currentStatus: QuotationStatus.DRAFT,
        action: QuotationStatusTransitionAction.REQUEST_APPROVAL,
      }),
    ).toBe(QuotationStatus.PENDING_APPROVAL);
  });

  it('rejects invalid transitions', () => {
    expect(() =>
      resolveQuotationStatusTransition({
        currentStatus: QuotationStatus.APPROVED,
        action: QuotationStatusTransitionAction.REQUEST_APPROVAL,
      }),
    ).toThrow('Quotation in APPROVED status cannot perform REQUEST_APPROVAL');
  });

  it('requires a reason for rejection transitions', () => {
    expect(() =>
      assertQuotationStatusTransition({
        currentStatus: QuotationStatus.PENDING_APPROVAL,
        action: QuotationStatusTransitionAction.REJECT,
      }),
    ).toThrow('A reason is required to reject');
  });

  it('allows approved quotations to convert', () => {
    expect(
      assertQuotationStatusTransition({
        currentStatus: QuotationStatus.APPROVED,
        action: QuotationStatusTransitionAction.CONVERT,
      }),
    ).toBe(QuotationStatus.CONVERTED);
  });
});
