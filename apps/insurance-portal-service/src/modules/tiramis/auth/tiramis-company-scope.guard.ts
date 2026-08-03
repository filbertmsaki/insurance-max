import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { TiramisAccessScopeService } from '../services/tiramis-access-scope.service';

@Injectable()
export class TiramisCompanyScopeGuard implements CanActivate {
  constructor(
    private readonly tiramisAccessScopeService: TiramisAccessScopeService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('Authentication is required');
    }

    const scope = this.tiramisAccessScopeService.resolveScope(user);

    const requestedCompanyId =
      request.query?.companyId ??
      request.query?.sourceCompanyId ??
      request.body?.companyId ??
      request.body?.sourceCompanyId ??
      request.params?.companyId ??
      request.params?.sourceCompanyId ??
      null;

    if (requestedCompanyId) {
      this.tiramisAccessScopeService.assertCanAccessCompany(
        scope,
        requestedCompanyId,
      );
    }

    const requestedBranchId =
      request.query?.branchId ??
      request.query?.sourceBranchId ??
      request.body?.branchId ??
      request.body?.sourceBranchId ??
      request.params?.branchId ??
      null;

    if (requestedBranchId) {
      this.tiramisAccessScopeService.assertCanAccessBranch(
        scope,
        requestedBranchId,
      );
    }

    /*
     * Make the trusted scope available to downstream handlers.
     */
    request.tiramisScope = scope;

    return true;
  }
}
