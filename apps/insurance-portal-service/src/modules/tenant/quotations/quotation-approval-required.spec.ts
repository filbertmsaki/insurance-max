import { ApprovalStatus } from './enums/approval-status.enum';
import { QuotationsService } from './quotations.service';

describe('QuotationsService quotation approval requirement', () => {
  // Both helpers are pure, so no dependencies are needed.
  const service: any = Object.create(QuotationsService.prototype);
  const payload = (approvalRequired: boolean) => ({
    cover_note: {
      entries: [
        {
          risks: [
            {
              discounts_offered: [
                { discount_amount: 1000, approval_required: approvalRequired },
              ],
            },
          ],
        },
      ],
    },
  });

  it('requires approval when a discount is beyond its approval threshold', () => {
    expect(service.payloadRequiresApproval(payload(true))).toBe(true);
    expect(service.payloadRequiresApproval(payload(false))).toBe(false);
  });

  it('starts a newly required approval as not submitted', () => {
    const state = service.mergeLifecycleState(
      {
        requires_approval: false,
        approval_status: ApprovalStatus.NOT_REQUIRED,
      },
      1,
      true,
    );
    expect(state).toMatchObject({
      requires_approval: true,
      approval_status: ApprovalStatus.NOT_SUBMITTED,
    });
  });

  it('keeps an approval already in progress and clears one no longer needed', () => {
    const inProgress = {
      requires_approval: true,
      approval_status: ApprovalStatus.APPROVED,
    };
    expect(
      service.mergeLifecycleState(inProgress, 1, true).approval_status,
    ).toBe(ApprovalStatus.APPROVED);
    expect(service.mergeLifecycleState(inProgress, 1, false)).toMatchObject({
      requires_approval: false,
      approval_status: ApprovalStatus.NOT_REQUIRED,
    });
  });
});
