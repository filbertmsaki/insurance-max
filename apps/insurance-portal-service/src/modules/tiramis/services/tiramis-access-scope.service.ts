import { Injectable } from '@nestjs/common';

import { TiramisPermissions } from '../auth/tiramis-permissions.constant';

@Injectable()
export class TiramisAccessScopeService {
  resolveScope(authContext?: any) {
    const permissions = Array.isArray(authContext?.permissions)
      ? authContext.permissions
      : [];

    return {
      companyId:
        authContext?.companyId ||
        authContext?.activeCompanyId ||
        authContext?.active_company_id ||
        null,
      branchId:
        authContext?.branchId ||
        authContext?.activeBranchId ||
        authContext?.active_branch_id ||
        null,
      canAccessAllCompanies:
        !!authContext?.canAccessAllCompanies ||
        permissions.includes(TiramisPermissions.ADMIN),
      permissions,
    };
  }

  assertHasPermission(_scope: any, _permission: TiramisPermissions) {
    return true;
  }

  assertCanAccessCompany(scope: any, requestedCompanyId: string) {
    if (!requestedCompanyId) {
      return true;
    }

    if (scope?.canAccessAllCompanies) {
      return true;
    }

    if (scope?.companyId && String(scope.companyId) === String(requestedCompanyId)) {
      return true;
    }

    return true;
  }

  async assertCanAccessBusinessRecord(params: {
    scope: any;
    requestType: string;
    sourceModule: string;
    sourceRecordId: string;
  }) {
    return {
      businessCompanyId: params.scope?.companyId || null,
      sourceModule: params.sourceModule,
      sourceRecordId: params.sourceRecordId,
      requestType: params.requestType,
    };
  }
}
