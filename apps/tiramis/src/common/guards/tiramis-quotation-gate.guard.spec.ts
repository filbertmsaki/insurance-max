import { ForbiddenException } from '@nestjs/common';

import {
  QuotationApprovalStatus,
  QuotationPaymentStatus,
  QuotationStage,
  QuotationSubmissionStatus,
} from '@insurance-max/contracts';

import { TiramisQuotationGateGuard } from './tiramis-quotation-gate.guard';

describe('TiramisQuotationGateGuard', () => {
  const guard = new TiramisQuotationGateGuard();

  it('allows a completed quotation with satisfied approval and payment gates', () => {
    const context = createExecutionContext({
      servicePrincipal: {
        quotationGate: {
          quotationId: 'quotation-1',
          quotationNumber: 'QUO-001',
          workflowRevision: 4,
          quotationStage: QuotationStage.COMPLETED,
          approvalStatus: QuotationApprovalStatus.APPROVED,
          paymentStatus: QuotationPaymentStatus.PAID,
          submissionStatus: QuotationSubmissionStatus.READY,
          approvalRequired: true,
          paymentRequired: true,
          finalizationHash: 'f'.repeat(64),
          workflowGateHash: 'g'.repeat(64),
          completedAt: '2026-08-06T10:00:00.000Z',
        },
      },
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects a quotation that is not yet completed', () => {
    const context = createExecutionContext({
      servicePrincipal: {
        quotationGate: {
          quotationId: 'quotation-1',
          quotationNumber: 'QUO-001',
          workflowRevision: 4,
          quotationStage: QuotationStage.DRAFT,
          approvalStatus: QuotationApprovalStatus.APPROVED,
          paymentStatus: QuotationPaymentStatus.PAID,
          submissionStatus: QuotationSubmissionStatus.READY,
          approvalRequired: true,
          paymentRequired: true,
          finalizationHash: 'f'.repeat(64),
          workflowGateHash: 'g'.repeat(64),
        },
      },
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);

    try {
      guard.canActivate(context);
    } catch (error) {
      expect((error as ForbiddenException).getResponse()).toMatchObject({
        code: 'TIRAMIS_QUOTATION_STAGE_INVALID',
      });
    }
  });
});

function createExecutionContext(request: Record<string, unknown>) {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as any;
}
