import {
  FULL_MODULE_ROLE_PERMISSIONS,
  expandSeedRolePermissions,
  unseededFullModulePermissions,
  withCustomerAuditPermission,
  withPricingPermissionAliases,
} from './001-initial-rbac.seed';
import {
  ClaimsPermissions,
  UNDERWRITE_COVER_PERMISSION_NAMES,
  UNDERWRITE_PERMISSION_NAMES,
} from '@insurance-max/contracts';

describe('full module role permissions', () => {
  it('includes the short-term role permissions in the full underwriter role', () => {
    const underwriter = expandSeedRolePermissions('UNDERWRITER', [
      ...FULL_MODULE_ROLE_PERMISSIONS.UNDERWRITER,
    ]);
    const shortTerm = expandSeedRolePermissions('SHORT_TERM_UNDERWRITER', [
      ...FULL_MODULE_ROLE_PERMISSIONS.SHORT_TERM_UNDERWRITER,
    ]);
    expect(underwriter).toEqual(expect.arrayContaining(shortTerm));
  });
  it.each(['SHORT_TERM_UNDERWRITER', 'UNDERWRITER'] as const)(
    'grants motor vehicle lookup to %s',
    (role) => {
      expect(expandSeedRolePermissions(role, [...FULL_MODULE_ROLE_PERMISSIONS[role]])).toContain('motor:read');
    },
  );
  it.each(['SHORT_TERM_UNDERWRITER', 'UNDERWRITER'] as const)(
    'grants motor verification submission to %s',
    (role) => {
      expect(expandSeedRolePermissions(role, [...FULL_MODULE_ROLE_PERMISSIONS[role]])).toContain('verifications:motor:submit');
    },
  );
  it.each(['SHORT_TERM_UNDERWRITER', 'UNDERWRITER'] as const)(
    'grants TIRAMIS submission, retry and sync to %s',
    (role) => {
      expect(expandSeedRolePermissions(role, [...FULL_MODULE_ROLE_PERMISSIONS[role]])).toEqual(
        expect.arrayContaining(['tiramis.submit', 'tiramis.retry', 'tiramis.sync']),
      );
    },
  );
  it('grants both short-term covers without expanding to whole-line permissions', () => {
    const permissions = expandSeedRolePermissions('SHORT_TERM_UNDERWRITER', [
      ...FULL_MODULE_ROLE_PERMISSIONS.SHORT_TERM_UNDERWRITER,
    ]);
    expect(permissions).toEqual(
      expect.arrayContaining(UNDERWRITE_COVER_PERMISSION_NAMES),
    );
    expect(permissions).toEqual(
      expect.arrayContaining([
        'quotations:read',
        'quotations:create',
        'quotations:approve',
        'policies:read',
      ]),
    );
    expect(
      permissions.filter((name) =>
        /^underwrite\.(motor|fleet|non_motor)\./.test(name),
      ),
    ).toEqual([]);
  });
  it('references permissions supplied by the seeder', () => {
    expect(unseededFullModulePermissions()).toEqual([]);
  });
  it('includes every claims workflow permission without underwriting grants', () => {
    expect(FULL_MODULE_ROLE_PERMISSIONS.CLAIMS).toEqual(
      expect.arrayContaining(Object.values(ClaimsPermissions)),
    );
    expect(
      FULL_MODULE_ROLE_PERMISSIONS.CLAIMS.some((name) =>
        name.startsWith('underwrite.'),
      ),
    ).toBe(false);
  });

  it('includes every underwriting line gate without claims permissions', () => {
    expect(FULL_MODULE_ROLE_PERMISSIONS.UNDERWRITER).toEqual(
      expect.arrayContaining(UNDERWRITE_PERMISSION_NAMES),
    );
    expect(
      FULL_MODULE_ROLE_PERMISSIONS.UNDERWRITER.some((name) =>
        name.startsWith('claims:'),
      ),
    ).toBe(false);
  });
});

describe('customer audit permission assignments', () => {
  it.each([
    'ADMINISTRATOR',
    'INSURANCE_ADMIN',
    'REINSURANCE_ADMIN',
    'BROKER_ADMIN',
    'AGENCY_ADMIN',
    'BANCASSURANCE_ADMIN',
    'PORTAL_ADMIN',
    'UNDERWRITER',
  ])('grants audit history to %s', (role) =>
    expect(withCustomerAuditPermission(role, ['customers:read'])).toContain(
      'customers:audit-history:read',
    ),
  );
  it.each(['USER', 'VIEWER', 'CLAIMS_OFFICER', 'CLAIMS_MANAGER'])(
    'does not add audit history to %s',
    (role) =>
      expect(
        withCustomerAuditPermission(role, ['customers:read']),
      ).not.toContain('customers:audit-history:read'),
  );
});

describe('quotation seed permission expansion', () => {
  it('does not grant approval authority merely because a role can edit quotations', () => {
    const expanded = withPricingPermissionAliases(['quotations:update']);
    expect(expanded).toContain('quotations:complete');
    expect(expanded).toContain('quotations:submit-approval');
    expect(expanded).not.toEqual(
      expect.arrayContaining([
        'quotations:approve',
        'quotations:approve-high-risk',
        'quotations:reject',
        'quotations:request-changes',
        'quotation-approvals:assign',
        'quotation-requirements:waive',
      ]),
    );
    for (const permission of [
      'quotations:approve',
      'quotations:approve-high-risk',
      'quotations:reject',
      'quotations:request-changes',
      'quotation-approvals:assign',
      'quotation-requirements:waive',
    ])
      expect(expanded).not.toContain(permission);
  });

  it('retains explicitly assigned approval permissions', () => {
    expect(withPricingPermissionAliases(['quotations:approve'])).toContain(
      'quotations:approve',
    );
  });
});
