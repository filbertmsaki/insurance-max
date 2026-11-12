import { describe, expect, it } from 'vitest';
import type { AuthUser } from '@/types';
import { canAccessRoute } from './permissions';

describe('role permission exclusions', () => {
  it('does not infer dashboard or policy access from the USER role', () => {
    const user: AuthUser = {
      id: 'user',
      email: 'user@example.com',
      scope: 'company',
      userType: 'COMPANY_USER',
      roles: ['USER'],
      permissions: [],
    };
    expect(
      canAccessRoute(user, { requiredPermission: 'dashboard:overview' }),
    ).toBe(false);
    expect(canAccessRoute(user, { requiredPermission: 'policies:read' })).toBe(
      false,
    );
    expect(
      canAccessRoute(
        { ...user, permissions: ['dashboard:overview'] },
        { requiredPermission: 'dashboard:overview' },
      ),
    ).toBe(true);
  });
});
