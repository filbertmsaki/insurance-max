import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';

import { TenantBoundaryGuard } from './tenant-boundary.guard';
import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

function buildContext(
  user: AuthenticatedUser | undefined,
  overrides: {
    params?: Record<string, unknown>;
    query?: Record<string, unknown>;
    body?: Record<string, unknown>;
  } = {},
): ExecutionContext {
  const request = {
    user,
    headers: {},
    params: overrides.params ?? {},
    query: overrides.query ?? {},
    body: overrides.body ?? {},
  };

  return {
    getHandler: () => ({}) as unknown,
    getClass: () => ({}) as unknown,
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

function buildReflector(enforceBoundary: boolean): Reflector {
  return {
    getAllAndOverride: () => enforceBoundary,
  } as unknown as Reflector;
}

const companyUser: AuthenticatedUser = {
  id: 'user-1',
  email: 'user@example.com',
  scope: 'company',
  userType: 'STAFF',
  sessionId: 'session-1',
  accessTokenId: 'token-1',
  companyId: 'company-a',
  companyMembershipId: 'membership-1',
  roles: ['STAFF'],
  permissions: [],
};

describe('TenantBoundaryGuard', () => {
  it('rejects a request whose body targets another company', () => {
    const guard = new TenantBoundaryGuard(buildReflector(true));

    expect(() =>
      guard.canActivate(
        buildContext(companyUser, { body: { company_id: 'company-b' } }),
      ),
    ).toThrow('belongs to another company');
  });

  it('allows a request scoped to the caller\'s own company', () => {
    const guard = new TenantBoundaryGuard(buildReflector(true));

    expect(
      guard.canActivate(
        buildContext(companyUser, { body: { company_id: 'company-a' } }),
      ),
    ).toBe(true);
  });

  it('passes through untouched when the boundary is not enforced', () => {
    const guard = new TenantBoundaryGuard(buildReflector(false));

    expect(guard.canActivate(buildContext(undefined))).toBe(true);
  });
});
