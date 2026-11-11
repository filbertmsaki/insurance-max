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
  UNDERWRITE_LINE_COVERS_KEY,
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
  covers = false,
) {
  const request: UnderwriteRequest = { user, params: { line } };
  const context = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  const reflector = {
    getAllAndOverride: (key: string) =>
      key === UNDERWRITE_LINE_ACTION_KEY
        ? (action ?? undefined)
        : key === UNDERWRITE_LINE_COVERS_KEY
          ? covers
          : undefined,
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

  describe('restricted cover grants (Short-Term)', () => {
    const shortTerm: AuthenticatedUser = {
      ...baseUser,
      permissions: [
        'underwrite.short_term.view',
        'underwrite.short_term.create',
      ],
    };

    it('admits a Short-Term holder to cover-filtered Motor routes only', () => {
      expect(
        run('motor', shortTerm, UnderwriteAction.CREATE, true).allowed,
      ).toBe(true);
      expect(() => run('motor', shortTerm, UnderwriteAction.CREATE)).toThrow(
        ForbiddenException,
      );
    });

    it('does not admit Short-Term Single to Fleet or Non-Motor routes', () => {
      expect(() =>
        run('fleet', shortTerm, UnderwriteAction.VIEW, true),
      ).toThrow(ForbiddenException);
      expect(() =>
        run('non-motor', shortTerm, UnderwriteAction.VIEW, true),
      ).toThrow(ForbiddenException);
    });

    it('never admits a cover grant to policy transaction routes', () => {
      expect(() =>
        run('motor', shortTerm, UnderwriteAction.ENDORSEMENTS_MANAGE, true),
      ).toThrow(ForbiddenException);
    });

    it('admits Short-Term Fleet holders to cover-filtered Fleet routes', () => {
      const fleet: AuthenticatedUser = {
        ...baseUser,
        permissions: ['underwrite.short_term_fleet.view'],
      };
      expect(run('fleet', fleet, UnderwriteAction.VIEW, true).allowed).toBe(
        true,
      );
      expect(() => run('motor', fleet, UnderwriteAction.VIEW, true)).toThrow(
        ForbiddenException,
      );
    });
  });
});
