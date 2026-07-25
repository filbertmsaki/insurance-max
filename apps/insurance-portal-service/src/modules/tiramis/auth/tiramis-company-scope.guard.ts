import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

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
      return true;
    }

    const scope = this.tiramisAccessScopeService.resolveScope({
      userId: user.id || user.sub || null,
      sub: user.sub || null,
      email: user.email || null,
      userType: user.user_type || user.userType || null,
      companyId:
        user.companyId ||
        user.active_company_id ||
        user.activeCompanyId ||
        null,
      activeCompanyId:
        user.active_company_id ||
        user.activeCompanyId ||
        user.companyId ||
        null,
      branchId:
        user.branchId || user.active_branch_id || user.activeBranchId || null,
      permissionCodes:
        user.permission_codes || user.permissionCodes || user.permissions || [],
      roleCodes: user.role_codes || user.roleCodes || user.roles || [],
      canAccessAllCompanies: user.canAccessAllCompanies || false,
      isPlatformAdmin: user.isPlatformAdmin || false,
    });

    const requestedCompanyId =
      request.query?.companyId ||
      request.query?.sourceCompanyId ||
      request.body?.companyId ||
      request.body?.sourceCompanyId ||
      request.params?.companyId ||
      request.params?.sourceCompanyId ||
      null;

    if (requestedCompanyId) {
      this.tiramisAccessScopeService.assertCanAccessCompany(
        scope,
        requestedCompanyId,
      );
    }

    return true;
  }
}
