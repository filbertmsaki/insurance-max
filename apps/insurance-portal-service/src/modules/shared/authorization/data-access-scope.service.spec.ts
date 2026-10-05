import { ForbiddenException } from '@nestjs/common';
import { CompanyType } from '@insurance-max/portal-shared/enums/company-type.enum';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

import { DataAccessScopeService } from './data-access-scope.service';
import { DataScopePermissions } from './data-scope.constants';
import { QuotationPolicyDataScope } from './quotation-policy-data-scope.enum';

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
    activeDepartmentId: 'department-1',
    assignedDepartmentIds: ['department-1', 'department-2'],
    roles: ['USER'],
    permissions: [],
  };

  beforeEach(() => {
    service = new DataAccessScopeService();
  });

  it('gives ordinary staff branch team access across every assigned branch', () => {
    const scope = service.resolve(baseUser);

    expect(scope.quotationPolicyDataScope).toBe(
      QuotationPolicyDataScope.BRANCH,
    );
    expect(scope.ownRecordsOnly).toBe(false);
    expect(scope.allowedBranchIds).toEqual(['branch-1', 'branch-2']);
  });

  it('keeps own-records access for staff without a branch assignment', () => {
    const scope = service.resolve({ ...baseUser, assignedBranchIds: [] });

    expect(scope.quotationPolicyDataScope).toBe(QuotationPolicyDataScope.USER);
    expect(scope.ownRecordsOnly).toBe(true);
  });

  it('keeps own-records access when explicitly granted', () => {
    const scope = service.resolve({
      ...baseUser,
      permissions: [DataScopePermissions.OWN_RECORDS],
    });

    expect(scope.quotationPolicyDataScope).toBe(QuotationPolicyDataScope.USER);
    expect(scope.ownRecordsOnly).toBe(true);
  });

  it('allows branch scope across assigned branches', () => {
    const scope = service.resolve({
      ...baseUser,
      quotationPolicyDataScope: 'BRANCH',
    });

    expect(scope.allowedBranchIds).toEqual(['branch-1', 'branch-2']);
  });

  it('allows department scope across assigned departments', () => {
    const scope = service.resolve({
      ...baseUser,
      quotationPolicyDataScope: 'DEPARTMENT',
    });

    expect(scope.allowedDepartmentIds).toEqual([
      'department-1',
      'department-2',
    ]);
  });

  it('allows company-wide access with explicit scope', () => {
    const scope = service.resolve({
      ...baseUser,
      quotationPolicyDataScope: 'COMPANY',
    });

    expect(scope.canViewAllBranches).toBe(true);
    expect(scope.allowedBranchIds).toEqual([]);
    expect(scope.ownRecordsOnly).toBe(false);
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
