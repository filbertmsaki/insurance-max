import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import Decimal from 'decimal.js';
import type { Request } from 'express';

import {
  QuotationPaymentStatus,
  type ServicePrincipal,
} from '@insurance-max/contracts';

@Injectable()
export class TiramisFinanceContextGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<
      Request & {
        servicePrincipal?: ServicePrincipal;
      }
    >();

    const quotationGate = request.servicePrincipal?.quotationGate;
    const finance = request.servicePrincipal?.finance;

    if (!quotationGate || !finance || !finance.paymentGateHash) {
      throw new ForbiddenException({
        code: 'TIRAMIS_FINANCE_CONTEXT_REQUIRED',
        message: 'A signed finance context is required.',
      });
    }

    if (quotationGate.paymentRequired) {
      if (quotationGate.paymentStatus !== QuotationPaymentStatus.PAID) {
        throw new ForbiddenException({
          code: 'TIRAMIS_PAYMENT_NOT_COMPLETE',
          message: 'The source invoice is not fully paid.',
        });
      }

      if (new Decimal(finance.balanceAmount).greaterThan(0)) {
        throw new ForbiddenException({
          code: 'TIRAMIS_INVOICE_BALANCE_REMAINS',
          message: 'The source invoice still has an outstanding balance.',
        });
      }
    }

    return true;
  }
}
