import { UnauthorizedException } from '@nestjs/common';

import { TiramisAdministratorGuard } from './tiramis-administrator.guard';

describe('TiramisAdministratorGuard', () => {
  const payload = {
    sub: 'admin-1',
    email: 'admin@example.test',
    type: 'access',
    scope: 'platform',
    userType: 'SUPER_ADMIN',
    jti: 'access-1',
    sessionId: 'session-1',
    permissions: ['tiramis:admin'],
  };

  function createGuard(options?: {
    config?: Record<string, unknown>;
    payload?: Record<string, unknown>;
    sessionRows?: Record<string, unknown>[];
  }) {
    const jwtService = {
      verifyAsync: jest.fn().mockResolvedValue({
        ...payload,
        ...(options?.payload ?? {}),
      }),
    };
    const config = {
      getOrThrow: jest.fn().mockReturnValue('local-admin-secret-32-characters'),
      get: jest.fn((key: string, fallback?: unknown) =>
        key in (options?.config ?? {}) ? options?.config?.[key] : fallback,
      ),
    };
    const dataSource = {
      query: jest.fn().mockResolvedValue(options?.sessionRows ?? []),
    };
    const request: Record<string, any> = {
      headers: { authorization: 'Bearer token' },
      ip: '203.0.113.10',
    };
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    };
    const guard = new TiramisAdministratorGuard(
      jwtService as any,
      config as any,
      dataSource as any,
    );

    return { guard, jwtService, config, dataSource, request, context };
  }

  it('accepts a platform administrator access token', async () => {
    const { guard, context, request } = createGuard();

    await expect(guard.canActivate(context as any)).resolves.toBe(true);
    expect(request.tiramisAdministrator).toEqual(
      expect.objectContaining({
        id: 'admin-1',
        sessionId: 'session-1',
        accessTokenId: 'access-1',
      }),
    );
  });

  it('enforces configured admin permissions', async () => {
    const { guard, context } = createGuard({
      config: {
        PORTAL_ADMIN_REQUIRED_PERMISSIONS: 'tiramis:admin,security:operate',
      },
    });

    await expect(guard.canActivate(context as any)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rate limits repeated admin requests without affecting callback guards', async () => {
    const { guard, context } = createGuard({
      config: {
        PORTAL_ADMIN_RATE_LIMIT_MAX: 1,
        PORTAL_ADMIN_RATE_LIMIT_WINDOW_MS: 60_000,
      },
    });

    await expect(guard.canActivate(context as any)).resolves.toBe(true);
    await expect(guard.canActivate(context as any)).rejects.toMatchObject({
      status: 429,
    });
  });

  it('rejects revoked live sessions when session validation is enabled', async () => {
    const { guard, context } = createGuard({
      config: {
        PORTAL_ADMIN_SESSION_VALIDATION_ENABLED: true,
      },
      sessionRows: [
        {
          id: 'session-1',
          user_id: 'admin-1',
          revoked: true,
          expires_at: new Date(Date.now() + 60_000),
        },
      ],
    });

    await expect(guard.canActivate(context as any)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
