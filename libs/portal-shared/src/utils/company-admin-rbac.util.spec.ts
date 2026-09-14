import { hasCompanyAdminRole } from './company-admin-rbac.util';

describe('hasCompanyAdminRole', () => {
  it('returns true for a user holding a company-administrator role', () => {
    expect(hasCompanyAdminRole({ roles: ['STAFF', 'INSURANCE_ADMIN'] })).toBe(
      true,
    );
  });

  it('returns false for a user without any company-administrator role', () => {
    expect(hasCompanyAdminRole({ roles: ['STAFF'] })).toBe(false);
  });

  it('returns false for the platform-only OWNER role', () => {
    expect(hasCompanyAdminRole({ roles: ['OWNER'] })).toBe(false);
  });

  it('returns false for null/undefined actors or missing roles', () => {
    expect(hasCompanyAdminRole(null)).toBe(false);
    expect(hasCompanyAdminRole(undefined)).toBe(false);
    expect(hasCompanyAdminRole({ roles: undefined as any })).toBe(false);
  });
});
