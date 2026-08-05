import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import type { Request } from 'express';

import type { ServicePrincipal } from '@insurance-max/contracts';

@Injectable()
export class TiramisTenantContextGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<
      Request & {
        servicePrincipal?: ServicePrincipal;
      }
    >();

    const principal = request.servicePrincipal;

    if (!principal?.tenant?.companyId) {
      throw new ForbiddenException({
        code: 'TIRAMIS_TENANT_CONTEXT_REQUIRED',
        message:
          'A signed tenant context is required for this TIRAMIS operation.',
      });
    }

    const headerCompanyId = request.headers['x-tenant-company-id'];

    if (
      typeof headerCompanyId !== 'string' ||
      headerCompanyId !== principal.tenant.companyId
    ) {
      throw new ForbiddenException({
        code: 'TIRAMIS_TENANT_CONTEXT_MISMATCH',
        message: 'The tenant header does not match the signed service token.',
      });
    }

    return true;
  }
}
