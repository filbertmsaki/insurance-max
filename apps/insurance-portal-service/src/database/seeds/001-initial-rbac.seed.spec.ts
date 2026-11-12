import {
  FULL_MODULE_ROLE_PERMISSIONS,
  expandSeedRolePermissions,
  unseededFullModulePermissions,
  withCustomerAuditPermission,
  withPricingPermissionAliases,
} from './001-initial-rbac.seed';
import InitialRbacSeeder from './001-initial-rbac.seed';
import {
  ClaimsPermissions,
  UNDERWRITE_COVER_PERMISSION_NAMES,
  UNDERWRITE_PERMISSION_NAMES,
} from '@insurance-max/contracts';

describe('full module role permissions', () => {
  it('requires an explicit password before creating a production seed account', () => {
    const previous = process.env.APP_ENV;
    process.env.APP_ENV = 'production';
    try {
      const seed = new InitialRbacSeeder();
      expect(() =>
        (seed as any).assertProductionSeedPassword({
          email: 'seed@example.test',
          passwordConfigured: false,
        }),
      ).toThrow();
      expect(() =>
        (seed as any).assertProductionSeedPassword({
          email: 'seed@example.test',
          passwordConfigured: true,
        }),
      ).not.toThrow();
    } finally {
      if (previous === undefined) delete process.env.APP_ENV;
      else process.env.APP_ENV = previous;
    }
  });
  it('updates existing system roles in other companies and preserves custom roles', async () => {
    const custom = {
      id: 'custom',
      name: 'TEST',
      company_id: 'default',
      is_system_generated: false,
      permissions: [],
    };
    const other = {
      id: 'other',
      name: 'TEST',
      company_id: 'other-company',
      is_system_generated: true,
      permissions: [],
    };
    const repo = {
      find: jest.fn().mockResolvedValue([other]),
      findOne: jest.fn().mockResolvedValue(custom),
      create: jest.fn(),
      save: jest.fn(async (role) => role),
      manager: { query: jest.fn().mockResolvedValue([]) },
    };
    const seed = new InitialRbacSeeder();
    await (seed as any).syncRoles(
      repo,
      [
        {
          name: 'TEST',
          displayName: 'Test',
          description: '',
          scopes: ['default_company'],
          permissionNames: ['test:read'],
        },
      ],
      new Map([['test:read', { id: 'permission', name: 'test:read' }]]),
      'default',
      'INSURANCE_COMPANY',
    );
    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'other',
        permissions: [expect.objectContaining({ name: 'test:read' })],
      }),
    );
    expect(custom.permissions).toEqual([]);
    expect(repo.manager.query).toHaveBeenCalledTimes(2);
  });
  it.each(['VIEWER', 'USER', 'CLAIMS_OFFICER', 'CUSTOMER_PORTAL'])(
    'does not add risk configuration writes to %s implicitly',
    (role) => {
      const permissions = expandSeedRolePermissions(role, []);
      expect(permissions).not.toContain('risk-required-factors:create');
      expect(permissions).not.toContain('risk-required-factors:update');
      expect(permissions).not.toContain('risk-required-factors:delete');
    },
  );
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
      expect(
        expandSeedRolePermissions(role, [
          ...FULL_MODULE_ROLE_PERMISSIONS[role],
        ]),
      ).toContain('motor:read');
    },
  );
  it.each(['SHORT_TERM_UNDERWRITER', 'UNDERWRITER'] as const)(
    'grants motor verification submission to %s',
    (role) => {
      expect(
        expandSeedRolePermissions(role, [
          ...FULL_MODULE_ROLE_PERMISSIONS[role],
        ]),
      ).toContain('verifications:motor:submit');
    },
  );
  it.each(['SHORT_TERM_UNDERWRITER', 'UNDERWRITER'] as const)(
    'grants TIRAMIS submission, retry and sync to %s',
    (role) => {
      expect(
        expandSeedRolePermissions(role, [
          ...FULL_MODULE_ROLE_PERMISSIONS[role],
        ]),
      ).toEqual(
        expect.arrayContaining([
          'tiramis.submit',
          'tiramis.retry',
          'tiramis.sync',
        ]),
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
