import {
  CanActivate,
  ExecutionContext,
  GoneException,
  Injectable,
} from '@nestjs/common';

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * The legacy `/tenant/billing/*` write endpoints changed invoices, receipts
 * and allocations without row locks, journal entries or the quotation
 * payment projection. All finance writes now go through `/tenant/finance/*`
 * (FinanceCommandService), so the legacy controller is read-only.
 */
@Injectable()
export class LegacyBillingReadOnlyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ method?: string }>();
    const method = (request.method ?? 'GET').toUpperCase();

    if (READ_METHODS.has(method)) {
      return true;
    }

    throw new GoneException(
      'Legacy /tenant/billing write endpoints are retired. Use the /tenant/finance endpoints instead.',
    );
  }
}
