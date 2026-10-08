import {
  hasOwnerRole,
  isReservedPlatformRoleName,
} from './system-generated-rbac.util';

describe('hasOwnerRole', () => {
  it('trusts the OWNER user type in any scope', () => {
    expect(
      hasOwnerRole({ userType: 'OWNER', roles: [], scope: 'company' } as any),
    ).toBe(true);
  });

  it('trusts an OWNER role name in platform scope', () => {
    expect(
      hasOwnerRole({
        userType: 'STAFF',
        roles: ['OWNER'],
        scope: 'platform',
      } as any),
    ).toBe(true);
  });

  it('ignores an OWNER role name in company scope (tenant-controlled)', () => {
    expect(
      hasOwnerRole({
        userType: 'STAFF',
        roles: ['OWNER'],
        scope: 'company',
      } as any),
    ).toBe(false);
  });

  it('ignores an OWNER role name when the scope is unknown', () => {
    expect(hasOwnerRole({ userType: 'STAFF', roles: ['OWNER'] } as any)).toBe(
      false,
    );
  });

  it('is false for no actor', () => {
    expect(hasOwnerRole(null)).toBe(false);
  });
});

describe('isReservedPlatformRoleName', () => {
  it.each(['OWNER', 'owner', ' Owner ', 'SUPER_ADMIN', 'super_admin'])(
    'reserves %p',
    (name) => {
      expect(isReservedPlatformRoleName(name)).toBe(true);
    },
  );

  it.each(['OWNERS', 'BRANCH_OWNER', 'ADMINISTRATOR', '', undefined])(
    'allows %p',
    (name) => {
      expect(isReservedPlatformRoleName(name)).toBe(false);
    },
  );
});
