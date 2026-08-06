import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import type { Request } from 'express';

import type { ServicePrincipal } from '@insurance-max/contracts';

@Injectable()
export class TiramisPricingContextGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<
      Request & {
        servicePrincipal?: ServicePrincipal;
      }
    >();

    const pricing = request.servicePrincipal?.pricing;

    if (
      !pricing ||
      !pricing.pricingQuoteId ||
      !pricing.rateBookId ||
      !pricing.rateBookDefinitionHash ||
      !pricing.matchedRuleId ||
      !pricing.resultHash
    ) {
      throw new ForbiddenException({
        code: 'TIRAMIS_PRICING_CONTEXT_REQUIRED',
        message: 'A signed pricing context is required.',
      });
    }

    return true;
  }
}
