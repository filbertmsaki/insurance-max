import {
  ForbiddenException,
  NotFoundException,
  type ExecutionContext,
} from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { UnderwriteAction, UnderwriteLine } from '@insurance-max/contracts';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import {
  UNDERWRITE_LINE_ACTION_KEY,
  type UnderwriteRequest,
} from './underwrite-line.access';
import { UnderwriteLineGuard } from './underwrite-line.guard';

const baseUser: AuthenticatedUser = {
  id: 'user-1',
  email: 'user@example.com',
  scope: 'company',
  userType: 'COMPANY_USER',
  sessionId: 'session-1',
  accessTokenId: 'token-1',
  companyId: 'company-1',
  companyMembershipId: 'membership-1',
  roles: ['UNDERWRITER'],
  permissions: ['underwrite.motor.view'],
};

function run(
  line: string,
  user: AuthenticatedUser | undefined,
  action: string | null = UnderwriteAction.VIEW,
) {
  const request: UnderwriteRequest = { user, params: { line } };
  const context = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  const reflector = {
    getAllAndOverride: (key: string) =>
      key === UNDERWRITE_LINE_ACTION_KEY ? (action ?? undefined) : undefined,
  } as unknown as Reflector;

  const allowed = new UnderwriteLineGuard(reflector).canActivate(context);
  return { allowed, request };
}

describe('UnderwriteLineGuard', () => {
  it('allows a user holding the line gate and exposes the resolved line', () => {
    const { allowed, request } = run('motor', baseUser);

    expect(allowed).toBe(true);
    expect(request.underwriteLine).toBe(UnderwriteLine.MOTOR);
  });

  it('rejects a user without the gate for that line', () => {
    expect(() => run('fleet', baseUser)).toThrow(ForbiddenException);
  });

  it('treats an unknown line as not found', () => {
    expect(() => run('marine', baseUser)).toThrow(NotFoundException);
  });

  it('fails closed when a route declares no line action', () => {
    expect(() => run('motor', baseUser, null)).toThrow(ForbiddenException);
  });

  it('lets platform owners through like the global guard', () => {
    const owner: AuthenticatedUser = {
      ...baseUser,
      scope: 'platform',
      userType: 'OWNER',
      permissions: [],
    };

    expect(run('non-motor', owner).allowed).toBe(true);
  });
});
