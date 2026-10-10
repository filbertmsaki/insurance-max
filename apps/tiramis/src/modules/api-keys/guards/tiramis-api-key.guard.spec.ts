import { ForbiddenException } from '@nestjs/common';
import { PUBLIC_SERVICE_ENDPOINT } from '@insurance-max/shared-kernel';

import { TiramisApiKeyGuard } from './tiramis-api-key.guard';

describe('TiramisApiKeyGuard', () => {
  function serviceContextHeader(value: unknown) {
    return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
  }

  const request = {
    headers: { 'x-api-key': 'service-key' },
    ip: '10.1.2.3',
    method: 'GET',
    baseUrl: '',
    path: '/api/tiramis/policies',
    route: { path: '/policies' },
    originalUrl: '/api/tiramis/policies',
    url: '/api/tiramis/policies',
  };

  function createGuard(
    scopes: string[] | undefined = ['tiramis:read'],
    contextType: 'http' | 'rpc' = 'http',
  ) {
    const reflector = {
      getAllAndOverride: jest.fn((key: string) => {
        if (key === PUBLIC_SERVICE_ENDPOINT) return false;
        return scopes;
      }),
    };
    const apiKeyService = {
      validate: jest.fn().mockResolvedValue({
        id: 'key-id',
        serviceName: 'insurance-portal-service',
        allowedIps: ['10.1.2.3'],
        scopes: ['tiramis:read'],
        tenantCompanyCode: null,
        tenantEnvironment: null,
        clientConfigurationId: null,
      }),
    };
    const requestContextService = {
      getRequestId: jest.fn().mockReturnValue('request-id'),
      setServicePrincipal: jest.fn(),
    };
    const accessAuditService = {
      record: jest.fn().mockResolvedValue(undefined),
    };
    const rpcData: Record<string, unknown> = {
      __serviceAuth: { apiKey: 'service-key' },
      requestType: 'POLICY',
      payload: { policyNumber: 'POL-1' },
    };
    const context = {
      getType: jest.fn().mockReturnValue(contextType),
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({ getRequest: () => ({ ...request }) }),
      switchToRpc: () => ({
        getData: () => rpcData,
        getContext: () => ({
          getSocketRef: () => ({ remoteAddress: '10.1.2.3' }),
          getPattern: () => 'tiramis.policy.submit',
        }),
      }),
    };

    return {
      guard: new TiramisApiKeyGuard(
        reflector as any,
        apiKeyService as any,
        requestContextService as any,
        accessAuditService as any,
      ),
      reflector,
      apiKeyService,
      requestContextService,
      accessAuditService,
      context,
      rpcData,
    };
  }

  it('passes endpoint scopes to API-key validation and attaches the granted scopes', async () => {
    const { guard, apiKeyService, requestContextService, context } =
      createGuard(['tiramis:read']);

    await expect(guard.canActivate(context as any)).resolves.toBe(true);

    expect(apiKeyService.validate).toHaveBeenCalledWith(
      'service-key',
      ['tiramis:read'],
      expect.objectContaining({ ipAddress: '10.1.2.3' }),
    );
    expect(requestContextService.setServicePrincipal).toHaveBeenCalledWith(
      expect.objectContaining({ scopes: ['tiramis:read'] }),
    );
  });

  it('fails closed when a protected HTTP endpoint has no declared scope', async () => {
    const { guard, apiKeyService, context, accessAuditService } = createGuard(
      [],
    );

    await expect(guard.canActivate(context as any)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(apiKeyService.validate).not.toHaveBeenCalled();
    expect(accessAuditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/policies',
        allowed: false,
        denialReason: 'ForbiddenException',
      }),
    );
  });

  it('does not authenticate explicitly public endpoints with a service key', async () => {
    const setup = createGuard(['tiramis:read']);
    setup.reflector.getAllAndOverride.mockImplementation((key: string) =>
      key === PUBLIC_SERVICE_ENDPOINT ? true : undefined,
    );

    await expect(setup.guard.canActivate(setup.context as any)).resolves.toBe(
      true,
    );
    expect(setup.apiKeyService.validate).not.toHaveBeenCalled();
    expect(setup.reflector.getAllAndOverride).toHaveBeenCalledWith(
      PUBLIC_SERVICE_ENDPOINT,
      expect.any(Array),
    );
  });

  it('authenticates TCP messages, checks the declared scope and strips transport credentials', async () => {
    const { guard, apiKeyService, context, rpcData } = createGuard(
      ['tiramis:submit'],
      'rpc',
    );

    await expect(guard.canActivate(context as any)).resolves.toBe(true);

    expect(apiKeyService.validate).toHaveBeenCalledWith(
      'service-key',
      ['tiramis:submit'],
      expect.objectContaining({
        ipAddress: '10.1.2.3',
        method: 'RPC',
        path: 'tiramis.policy.submit',
      }),
    );
    expect(rpcData.__serviceAuth).toBeUndefined();
    expect(rpcData).toEqual(
      expect.objectContaining({
        requestType: 'POLICY',
        servicePrincipal: expect.objectContaining({
          scopes: ['tiramis:read'],
        }),
      }),
    );
  });

  it('rejects TCP messages without a transport credential envelope', async () => {
    const setup = createGuard(['tiramis:submit'], 'rpc');
    delete setup.rpcData.__serviceAuth;

    await expect(setup.guard.canActivate(setup.context as any)).rejects.toThrow(
      'Authenticated TIRAMIS service envelope is required',
    );
    expect(setup.apiKeyService.validate).not.toHaveBeenCalled();
    expect(setup.accessAuditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'RPC',
        path: 'tiramis.policy.submit',
        allowed: false,
      }),
    );
  });

  it('audits API-key scope denials at the access-log layer', async () => {
    const setup = createGuard(['tiramis:submit']);
    setup.apiKeyService.validate.mockRejectedValue(
      new ForbiddenException('API key does not have required scope'),
    );

    await expect(
      setup.guard.canActivate(setup.context as any),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(setup.accessAuditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        serviceScopes: ['tiramis:submit'],
        allowed: false,
        denialReason: 'ForbiddenException',
      }),
    );
  });

  it('rejects a service context for a different TIRAMIS company binding', async () => {
    const setup = createGuard(['tiramis:submit']);
    setup.apiKeyService.validate.mockResolvedValue({
      id: 'key-id',
      serviceName: 'insurance-portal-service',
      allowedIps: ['10.1.2.3'],
      scopes: ['tiramis:submit'],
      tenantCompanyCode: '123456',
      tenantEnvironment: 'test',
      clientConfigurationId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    });
    setup.context.switchToHttp = () => ({
      getRequest: () => ({
        ...request,
        headers: {
          ...request.headers,
          'x-service-context': serviceContextHeader({
            tenant: {
              companyId: 'company-id',
              companyCode: '654321',
              systemCode: 'PORTAL',
              environment: 'test',
              clientConfigurationId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            },
          }),
        },
      }),
    });

    await expect(
      setup.guard.canActivate(setup.context as any),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(setup.accessAuditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        allowed: false,
        denialReason: 'ForbiddenException',
      }),
    );
  });

  it('uses the API-key tenant binding as authoritative when context matches', async () => {
    const setup = createGuard(['tiramis:submit']);
    setup.apiKeyService.validate.mockResolvedValue({
      id: 'key-id',
      serviceName: 'insurance-portal-service',
      allowedIps: ['10.1.2.3'],
      scopes: ['tiramis:submit'],
      tenantCompanyCode: '123456',
      tenantEnvironment: 'test',
      clientConfigurationId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    });
    setup.context.switchToHttp = () => ({
      getRequest: () => ({
        ...request,
        headers: {
          ...request.headers,
          'x-service-context': serviceContextHeader({
            tenant: {
              companyId: 'company-id',
              companyCode: '123456',
              systemCode: 'PORTAL',
              environment: 'test',
            },
          }),
        },
      }),
    });

    await expect(setup.guard.canActivate(setup.context as any)).resolves.toBe(
      true,
    );
    expect(
      setup.requestContextService.setServicePrincipal,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant: expect.objectContaining({
          companyCode: '123456',
          systemCode: 'PORTAL',
          environment: 'test',
          clientConfigurationId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        }),
      }),
    );
  });
});
