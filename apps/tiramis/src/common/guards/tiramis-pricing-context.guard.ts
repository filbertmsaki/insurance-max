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

    // A risk priced from a direct rating rule (no configured rate book, as
    // with every non-motor risk today) legitimately carries no rateBookId.
    // Require the rate-book hash only when a rate book was actually matched.
    if (
      !pricing ||
      !pricing.pricingQuoteId ||
      !pricing.matchedRuleId ||
      !pricing.resultHash ||
      (pricing.rateBookId && !pricing.rateBookDefinitionHash)
    ) {
      throw new ForbiddenException({
        code: 'TIRAMIS_PRICING_CONTEXT_REQUIRED',
        message: 'A signed pricing context is required.',
      });
    }

    return true;
  }
}
