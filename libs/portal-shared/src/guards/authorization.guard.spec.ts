import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';

import { AuthorizationGuard } from './authorization.guard';
import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

function buildContext(user?: AuthenticatedUser): ExecutionContext {
  const request = { user };

  return {
    getHandler: () => ({}) as unknown,
    getClass: () => ({}) as unknown,
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

function buildReflector(metadata: Record<string, unknown>): Reflector {
  return {
    getAllAndOverride: (key: string) => metadata[key],
  } as unknown as Reflector;
}

const baseUser: AuthenticatedUser = {
  id: 'user-1',
  email: 'user@example.com',
  scope: 'company',
  userType: 'STAFF',
  sessionId: 'session-1',
  accessTokenId: 'token-1',
  companyId: 'company-1',
  companyMembershipId: 'membership-1',
  roles: ['STAFF'],
  permissions: ['quotations:read'],
};

describe('AuthorizationGuard', () => {
  it('enforces an all-permissions requirement', () => {
    const reflector = buildReflector({
      permissions: ['quotations:create'],
    });

    const guard = new AuthorizationGuard(reflector);

    expect(() => guard.canActivate(buildContext(baseUser))).toThrow();
  });

  it('allows the request when all required permissions are present', () => {
    const reflector = buildReflector({
      permissions: ['quotations:read'],
    });

    const guard = new AuthorizationGuard(reflector);

    expect(guard.canActivate(buildContext(baseUser))).toBe(true);
  });

  it('enforces an any-role requirement', () => {
    const reflector = buildReflector({
      'authorization:all-roles': ['ADMINISTRATOR'],
    });

    const guard = new AuthorizationGuard(reflector);

    expect(() => guard.canActivate(buildContext(baseUser))).toThrow();
  });

  it('rejects a company-scoped token from a platform-only route', () => {
    const reflector = buildReflector({
      'authorization:access-scopes': ['platform'],
    });

    const guard = new AuthorizationGuard(reflector);

    expect(() => guard.canActivate(buildContext(baseUser))).toThrow();
  });
});
