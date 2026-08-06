import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import type { Request } from 'express';

import {
  QuotationApprovalStatus,
  QuotationPaymentStatus,
  QuotationStage,
  type ServicePrincipal,
} from '@insurance-max/contracts';

@Injectable()
export class TiramisQuotationGateGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<
      Request & {
        servicePrincipal?: ServicePrincipal;
      }
    >();

    const quotationGate = request.servicePrincipal?.quotationGate;

    if (
      !quotationGate ||
      !quotationGate.quotationId ||
      !quotationGate.quotationNumber ||
      !quotationGate.finalizationHash ||
      !quotationGate.workflowGateHash
    ) {
      throw new ForbiddenException({
        code: 'TIRAMIS_QUOTATION_GATE_REQUIRED',
        message: 'A signed quotation workflow gate context is required.',
      });
    }

    if (quotationGate.quotationStage !== QuotationStage.COMPLETED) {
      throw new ForbiddenException({
        code: 'TIRAMIS_QUOTATION_STAGE_INVALID',
        message:
          'The signed quotation workflow stage must be COMPLETED before submission.',
      });
    }

    if (
      quotationGate.approvalRequired &&
      quotationGate.approvalStatus !== QuotationApprovalStatus.APPROVED
    ) {
      throw new ForbiddenException({
        code: 'TIRAMIS_QUOTATION_APPROVAL_REQUIRED',
        message:
          'The signed quotation approval status must be APPROVED before submission.',
      });
    }

    if (
      quotationGate.paymentRequired &&
      quotationGate.paymentStatus !== QuotationPaymentStatus.PAID
    ) {
      throw new ForbiddenException({
        code: 'TIRAMIS_QUOTATION_PAYMENT_REQUIRED',
        message:
          'The signed quotation payment status must be PAID before submission.',
      });
    }

    return true;
  }
}
