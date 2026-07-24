import {
  assertQuotationStatusTransition,
  resolveQuotationStatusTransition,
} from './quotation-status-transition.util';
import { QuotationStatus } from '../enums/quotation-status.enum';
import { QuotationStatusTransitionAction } from '../enums/quotation-status-transition-action.enum';

describe('quotation status transition util', () => {
  it('maps DRAFT request approval to SUBMITTED_TO_TIRA', () => {
    expect(
      resolveQuotationStatusTransition({
        currentStatus: QuotationStatus.DRAFT,
        action: QuotationStatusTransitionAction.REQUEST_APPROVAL,
      }),
    ).toBe(QuotationStatus.SUBMITTED_TO_TIRA);
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

  it('allows submitted quotations to approve', () => {
    expect(
      resolveQuotationStatusTransition({
        currentStatus: QuotationStatus.SUBMITTED_TO_TIRA,
        action: QuotationStatusTransitionAction.APPROVE,
      }),
    ).toBe(QuotationStatus.APPROVED);
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
