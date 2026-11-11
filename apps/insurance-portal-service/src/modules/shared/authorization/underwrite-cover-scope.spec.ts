import { CompanyType } from '@insurance-max/portal-shared/enums/company-type.enum';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

import { DataAccessScopeService } from './data-access-scope.service';
import { QuotationPolicyDataScope } from './quotation-policy-data-scope.enum';
import {
  coversForPermission,
  policyCoverSql,
  quotationCoverSql,
  resolveCoverScope,
} from './underwrite-cover-scope';

const SHORT_TERM_UNDERWRITER = [
  'quotations:read',
  'quotations:create',
  'quotations:update',
  'quotations:complete',
  'quotations:submit-approval',
  'quotations:request-payment',
  'policies:read',
  'underwrite.short_term.view',
  'underwrite.short_term.create',
  'underwrite.short_term.edit',
  'underwrite.short_term.submit',
  'underwrite.short_term.policies.view',
];

const ALL_LINES_VIEW = [
  'quotations:read',
  'underwrite.motor.view',
  'underwrite.fleet.view',
  'underwrite.non_motor.view',
];

const set = (items: string[]) => new Set(items);

describe('coversForPermission', () => {
  it('restricts a Short-Term underwriter to Short-Term Single', () => {
    const permissions = set(SHORT_TERM_UNDERWRITER);
    expect(coversForPermission(permissions, 'quotations:read')).toEqual([
      'SHORT_TERM_SINGLE',
    ]);
    expect(coversForPermission(permissions, 'quotations:create')).toEqual([
      'SHORT_TERM_SINGLE',
    ]);
    expect(coversForPermission(permissions, 'policies:read')).toEqual([
      'SHORT_TERM_SINGLE',
    ]);
  });

  it('gives no records for an action held without a cover grant', () => {
    // Holds quotations:approve but no approve grant on any cover.
    const permissions = set([...SHORT_TERM_UNDERWRITER, 'quotations:approve']);
    expect(coversForPermission(permissions, 'quotations:approve')).toEqual([]);
  });

  it('keeps existing broad access unchanged (line grants include Short-Term)', () => {
    expect(coversForPermission(set(ALL_LINES_VIEW), 'quotations:read')).toEqual(
      ['MOTOR', 'FLEET', 'NON_MOTOR', 'SHORT_TERM_SINGLE', 'SHORT_TERM_FLEET'],
    );
  });

  it('combines Short-Term with Fleet and Non-Motor grants', () => {
    const permissions = set([
      ...SHORT_TERM_UNDERWRITER,
      'underwrite.fleet.view',
      'underwrite.non_motor.view',
    ]);
    expect(coversForPermission(permissions, 'quotations:read')).toEqual([
      'FLEET',
      'NON_MOTOR',
      'SHORT_TERM_SINGLE',
      'SHORT_TERM_FLEET',
    ]);
    expect(coversForPermission(permissions, 'quotations:create')).toEqual([
      'SHORT_TERM_SINGLE',
    ]);
  });

  it('narrows non-underwriting contexts only for restricted-cover holders', () => {
    expect(
      coversForPermission(set(SHORT_TERM_UNDERWRITER), 'claims:read'),
    ).toEqual(['SHORT_TERM_SINGLE']);
    expect(coversForPermission(set(ALL_LINES_VIEW), 'claims:read')).toBeNull();
    expect(coversForPermission(set(['claims:read']), 'claims:read')).toBeNull();
  });

  it('does not narrow scope checks for permissions the caller does not hold', () => {
    // Portal and internal calls scope with quotations:update without holding it.
    expect(
      coversForPermission(set(['quotations:read']), 'quotations:update'),
    ).toBeNull();
  });

  it('reflects revocation immediately (pure function of current permissions)', () => {
    const before = set([...SHORT_TERM_UNDERWRITER, 'underwrite.motor.view']);
    expect(coversForPermission(before, 'quotations:read')).toContain('MOTOR');
    before.delete('underwrite.motor.view');
    expect(coversForPermission(before, 'quotations:read')).toEqual([
      'SHORT_TERM_SINGLE',
    ]);
    before.delete('underwrite.short_term.view');
    expect(coversForPermission(before, 'quotations:read')).toEqual([]);
  });
});

describe('resolveCoverScope', () => {
  it('applies the strict rule to the side the permission belongs to', () => {
    const permissions = set([
      ...SHORT_TERM_UNDERWRITER,
      'underwrite.fleet.policies.view',
    ]);
    expect(resolveCoverScope(permissions, 'quotations:read')).toEqual({
      quotationCovers: ['SHORT_TERM_SINGLE'],
      policyCovers: ['FLEET', 'SHORT_TERM_SINGLE', 'SHORT_TERM_FLEET'],
    });
    expect(resolveCoverScope(permissions, 'policies:read')).toEqual({
      quotationCovers: ['FLEET', 'SHORT_TERM_SINGLE', 'SHORT_TERM_FLEET'],
      policyCovers: ['FLEET', 'SHORT_TERM_SINGLE', 'SHORT_TERM_FLEET'],
    });
  });
});

describe('DataAccessScopeService cover restriction', () => {
  const user: AuthenticatedUser = {
    id: 'user-1',
    email: 'user@example.com',
    scope: 'company',
    userType: 'COMPANY_USER',
    companyId: 'company-1',
    companyName: 'Test Company',
    companySlug: 'test-company',
    companyType: CompanyType.INSURANCE_COMPANY,
    companyMembershipId: 'membership-1',
    activeBranchId: 'branch-1',
    assignedBranchIds: ['branch-1'],
    roles: ['USER'],
    permissions: SHORT_TERM_UNDERWRITER,
  };
  const service = new DataAccessScopeService();

  function fakeQueryBuilder() {
    const where: string[] = [];
    const params: Record<string, unknown> = {};
    const qb = {
      where,
      params,
      andWhere: jest.fn((condition: unknown, values?: object) => {
        where.push(String(condition));
        Object.assign(params, values ?? {});
        return qb;
      }),
      setParameters: jest.fn((values: object) => {
        Object.assign(params, values);
        return qb;
      }),
      setParameter: jest.fn((key: string, value: unknown) => {
        params[key] = value;
        return qb;
      }),
    };
    return qb;
  }

  it('applies the cover restriction together with the branch data scope', () => {
    const scope = service.resolve(user, 'quotations:read');
    expect(scope.quotationPolicyDataScope).toBe(
      QuotationPolicyDataScope.BRANCH,
    );
    expect(scope.quotationCovers).toEqual(['SHORT_TERM_SINGLE']);

    const qb = fakeQueryBuilder();
    service.applyQuotationReadScope(qb, 'quotation', scope);
    expect(qb.where.some((item) => item.includes('branch_id IN'))).toBe(true);
    expect(
      qb.where.some((item) => item.includes('IN (:...scopeQuotationCovers)')),
    ).toBe(true);
    expect(qb.params.scopeQuotationCovers).toEqual(['SHORT_TERM_SINGLE']);
  });

  it('matches no rows when no cover is granted for the action', () => {
    const scope = service.resolve(
      {
        ...user,
        permissions: [...SHORT_TERM_UNDERWRITER, 'quotations:approve'],
      },
      'quotations:approve',
    );
    const qb = fakeQueryBuilder();
    service.applyQuotationReadScope(qb, 'quotation', scope);
    expect(qb.where).toContain('1 = 0');
  });

  it('filters policies and policy transactions by cover', () => {
    const scope = service.resolve(user, 'policies:read');
    const qb = fakeQueryBuilder();
    service.applyPolicyReadScope(qb, 'policy', scope);
    expect(qb.params.scopePolicyCovers).toEqual(['SHORT_TERM_SINGLE']);

    const approvals = fakeQueryBuilder();
    service.applyPolicyTransactionReadScope(
      approvals,
      'policy',
      'transaction',
      scope,
      true,
    );
    expect(approvals.params.scopePolicyCovers).toEqual(['SHORT_TERM_SINGLE']);
  });

  it('adds nothing for users without restricted grants outside quotation contexts', () => {
    const scope = service.resolve(
      { ...user, permissions: ['claims:read', ...ALL_LINES_VIEW] },
      'claims:read',
    );
    expect(scope.policyCovers).toBeNull();
    const qb = fakeQueryBuilder();
    service.applyPolicyReadScope(qb, 'policy', scope);
    expect(qb.params.scopePolicyCovers).toBeUndefined();
  });

  it('classifies unclassified rows by line, never as a restricted cover', () => {
    expect(quotationCoverSql('q')).toContain(
      "WHEN 'MOTOR_SINGLE' THEN 'MOTOR'",
    );
    expect(quotationCoverSql('q')).not.toContain('SHORT_TERM');
    expect(policyCoverSql('p')).toContain('cover_quotation.underwrite_cover');
  });
});
