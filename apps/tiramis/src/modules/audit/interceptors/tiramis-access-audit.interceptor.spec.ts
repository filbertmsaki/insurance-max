import { firstValueFrom, of, throwError } from 'rxjs';
import { PUBLIC_SERVICE_ENDPOINT } from '@insurance-max/shared-kernel';

import { TiramisAccessAuditInterceptor } from './tiramis-access-audit.interceptor';

describe('TiramisAccessAuditInterceptor', () => {
  const reflector = {
    getAllAndOverride: jest.fn((key: string) =>
      key === PUBLIC_SERVICE_ENDPOINT ? false : ['tiramis:read'],
    ),
  };
  let auditService: { begin: jest.Mock; complete: jest.Mock };
  let interceptor: TiramisAccessAuditInterceptor;

  beforeEach(() => {
    auditService = {
      begin: jest.fn().mockResolvedValue('audit-1'),
      complete: jest.fn().mockResolvedValue(undefined),
    };
    interceptor = new TiramisAccessAuditInterceptor(
      auditService as any,
      reflector as any,
    );
  });

  it('records HTTP access using a route path without query values', async () => {
    const context = {
      getType: () => 'http',
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {
            'x-request-id': 'req-1',
            'x-correlation-id': 'corr-1',
          },
          servicePrincipal: {
            serviceId: 'portal',
            scopes: ['tiramis:read', 'tiramis:submit'],
          },
          method: 'GET',
          baseUrl: '/api/tiramis/submissions',
          path: '/trace',
          originalUrl: '/trace?token=must-not-be-audited',
          route: { path: '/trace' },
        }),
        getResponse: () => ({ statusCode: 200 }),
      }),
    };

    await expect(
      firstValueFrom(
        interceptor.intercept(context as any, {
          handle: () => of({ ok: true }),
        }),
      ),
    ).resolves.toEqual({ ok: true });

    expect(auditService.begin).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 'req-1',
        callingService: 'portal',
        serviceScopes: ['tiramis:read', 'tiramis:submit'],
        method: 'GET',
        path: '/api/tiramis/submissions/trace',
      }),
    );
    expect(auditService.complete).toHaveBeenCalledWith(
      'audit-1',
      expect.objectContaining({ allowed: true, statusCode: 200 }),
    );
    expect(JSON.stringify(auditService.begin.mock.calls)).not.toContain(
      'must-not-be-audited',
    );
  });

  it('records RPC access with the message pattern and authenticated principal', async () => {
    const context = {
      getType: () => 'rpc',
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToRpc: () => ({
        getData: () => ({
          servicePrincipal: {
            serviceId: 'portal',
            scopes: ['tiramis:submit'],
          },
        }),
        getContext: () => ({ getPattern: () => 'tiramis.motor_fleet.submit' }),
      }),
    };

    await expect(
      firstValueFrom(
        interceptor.intercept(context as any, { handle: () => of('accepted') }),
      ),
    ).resolves.toBe('accepted');

    expect(auditService.begin).toHaveBeenCalledWith(
      expect.objectContaining({
        callingService: 'portal',
        method: 'RPC',
        path: 'tiramis.motor_fleet.submit',
        serviceScopes: ['tiramis:submit'],
      }),
    );
  });

  it('completes authorized handler failures by exception type without persisting raw messages', async () => {
    const context = {
      getType: () => 'rpc',
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToRpc: () => ({
        getData: () => ({ servicePrincipal: { serviceId: 'portal' } }),
        getContext: () => ({ getPattern: () => 'tiramis.policy.submit' }),
      }),
    };
    const failure = new Error('upstream secret=do-not-store');

    await expect(
      firstValueFrom(
        interceptor.intercept(context as any, {
          handle: () => throwError(() => failure),
        }),
      ),
    ).rejects.toBe(failure);

    expect(auditService.complete).toHaveBeenCalledWith(
      'audit-1',
      expect.objectContaining({
        denialReason: 'Error',
        statusCode: 500,
        allowed: true,
      }),
    );
    expect(JSON.stringify(auditService.complete.mock.calls)).not.toContain(
      'do-not-store',
    );
  });

  it('does not run the handler when audit intent cannot be persisted', async () => {
    auditService.begin.mockRejectedValue(new Error('database down'));
    const handle = jest.fn(() => of('accepted'));
    const context = {
      getType: () => 'rpc',
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToRpc: () => ({ getData: () => ({}), getContext: () => ({}) }),
    };

    await expect(
      firstValueFrom(interceptor.intercept(context as any, { handle })),
    ).rejects.toThrow('database down');
    expect(handle).not.toHaveBeenCalled();
  });
});
