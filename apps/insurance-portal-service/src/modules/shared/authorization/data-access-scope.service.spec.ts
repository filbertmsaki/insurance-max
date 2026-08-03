import { ForbiddenException } from '@nestjs/common';
import { CompanyType } from '@insurance-max/portal-shared/enums/company-type.enum';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

import { DataAccessScopeService } from './data-access-scope.service';
import { DataScopePermissions } from './data-scope.constants';

describe('DataAccessScopeService', () => {
  let service: DataAccessScopeService;

  const baseUser: AuthenticatedUser = {
    id: 'user-1',
    email: 'user@example.com',
    scope: 'company',
    userType: 'STAFF',
    companyId: 'company-1',
    companyName: 'Test Company',
    companySlug: 'test-company',
    companyType: CompanyType.INSURANCE_COMPANY,
    companyMembershipId: 'membership-1',
    activeBranchId: 'branch-1',
    assignedBranchIds: ['branch-1', 'branch-2'],
    roles: ['USER'],
    permissions: [],
  };

  beforeEach(() => {
    service = new DataAccessScopeService();
  });

  it('defaults ordinary staff to active branch', () => {
    const scope = service.resolve(baseUser);

    expect(scope.canViewAllBranches).toBe(false);
    expect(scope.allowedBranchIds).toEqual(['branch-1']);
  });

  it('allows assigned branches with permission', () => {
    const scope = service.resolve({
      ...baseUser,
      permissions: [DataScopePermissions.ASSIGNED_BRANCHES],
    });

    expect(scope.allowedBranchIds).toEqual(['branch-1', 'branch-2']);
  });

  it('allows company-wide access with permission', () => {
    const scope = service.resolve({
      ...baseUser,
      permissions: [DataScopePermissions.COMPANY_ALL],
    });

    expect(scope.canViewAllBranches).toBe(true);
    expect(scope.allowedBranchIds).toEqual([]);
  });

  it('restricts agents to their own records', () => {
    const scope = service.resolve({
      ...baseUser,
      userType: 'AGENT',
    });

    expect(scope.ownRecordsOnly).toBe(true);
  });

  it('rejects an unassigned branch', () => {
    const scope = service.resolve(baseUser);

    expect(() =>
      service.assertRequestedBranchAllowed(scope, 'branch-3'),
    ).toThrow(ForbiddenException);
  });

  it('allows insurer partner portfolio only with both permissions', () => {
    const scope = service.resolve({
      ...baseUser,
      permissions: [
        DataScopePermissions.COMPANY_ALL,
        DataScopePermissions.PARTNER_PORTFOLIO,
      ],
    });

    expect(scope.canViewCarrierPortfolio).toBe(true);
  });

  it('does not grant partner portfolio to branch users', () => {
    const scope = service.resolve({
      ...baseUser,
      permissions: [DataScopePermissions.PARTNER_PORTFOLIO],
    });

    expect(scope.canViewCarrierPortfolio).toBe(false);
  });
});
