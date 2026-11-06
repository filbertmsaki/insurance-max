import { QuotationDisplayStatusResolver } from './quotation-display-status.resolver';
import { QuotationStatus } from '../enums/quotation-status.enum';
import { TiraStatus } from '../enums/tira-status.enum';
import { ApprovalStatus } from '../enums/approval-status.enum';
import { PaymentStatus } from '../enums/payment-status.enum';

describe('QuotationDisplayStatusResolver regulatory outcomes', () => {
  const resolver = new QuotationDisplayStatusResolver();
  const legacy = {
    status: QuotationStatus.COMPLETED,
    approval_status: ApprovalStatus.NOT_REQUIRED,
    payment_status: PaymentStatus.PAID,
    tira_status: TiraStatus.SUBMITTED,
  };
  it.each([
    [TiraStatus.SUBMITTED, 'Submitted to TIRAMIS'],
    [TiraStatus.PROCESSING, 'Processing at TIRAMIS'],
    [TiraStatus.FAILED, 'TIRAMIS Submission Failed'],
    [TiraStatus.REJECTED, 'Rejected by TIRAMIS'],
    [TiraStatus.SUCCESS, 'Completed'],
  ])('shows %s for a legacy completed quotation', (tira_status, label) => {
    expect(resolver.resolve({ ...legacy, tira_status }).displayLabel).toBe(
      label,
    );
  });
});
