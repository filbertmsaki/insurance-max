import { ForbiddenException, UnauthorizedException } from '@nestjs/common';

import { TiramisApiKeyService } from './tiramis-api-key.service';

describe('TiramisApiKeyService', () => {
  function createService() {
    const apiKeyRepository = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ id: 'key-id', ...value })),
      find: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
    };
    const auditRepository = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ id: 'audit-id', ...value })),
      find: jest.fn(),
    };
    const clientConfigurationRepository = {
      findOne: jest.fn(),
    };

    return {
      service: new TiramisApiKeyService(
        apiKeyRepository as any,
        auditRepository as any,
        clientConfigurationRepository as any,
      ),
      apiKeyRepository,
      auditRepository,
      clientConfigurationRepository,
    };
  }

  it('creates a key and stores the plain API key value, resolving its clientConfigurationId', async () => {
    const { service, apiKeyRepository, clientConfigurationRepository } =
      createService();
    clientConfigurationRepository.findOne.mockResolvedValue({
      id: 'config-1',
    });

    const created = await service.create({
      name: 'Portal',
      serviceName: 'insurance-portal-service',
      tenantCompanyCode: 'ICC110',
      tenantSystemCode: 'LSYS_ALLIANCE_003',
      tenantEnvironment: 'live',
      scopes: ['tiramis:submit'],
    });

    expect(created.apiKey).toMatch(/^tms_/);
    expect(clientConfigurationRepository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyCode: 'ICC110',
          systemCode: 'LSYS_ALLIANCE_003',
          environment: 'live',
        }),
      }),
    );
    expect(apiKeyRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: created.apiKey,
        serviceName: 'insurance-portal-service',
        tenantCompanyCode: 'ICC110',
        tenantSystemCode: 'LSYS_ALLIANCE_003',
        tenantEnvironment: 'live',
        clientConfigurationId: 'config-1',
      }),
    );
    expect(apiKeyRepository.save.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        serviceName: 'insurance-portal-service',
        scopes: ['tiramis:submit'],
      }),
    );
  });

  it('creates a tenant-less key (e.g. bootstrap/admin) without resolving a configuration', async () => {
    const { service, apiKeyRepository, clientConfigurationRepository } =
      createService();

    const created = await service.create({
      name: 'Bootstrap',
      serviceName: 'insurance-portal-service-bootstrap',
      scopes: ['tiramis:admin'],
    });

    expect(clientConfigurationRepository.findOne).not.toHaveBeenCalled();
    expect(apiKeyRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        clientConfigurationId: null,
      }),
    );
    expect(created.apiKey).toMatch(/^tms_/);
  });

  it('rejects creating a key whose tenant triple has no matching active configuration', async () => {
    const { service, clientConfigurationRepository } = createService();
    clientConfigurationRepository.findOne.mockResolvedValue(null);

    await expect(
      service.create({
        name: 'Portal',
        serviceName: 'insurance-portal-service',
        tenantCompanyCode: 'ICC999',
        tenantSystemCode: 'LSYS_UNKNOWN',
        tenantEnvironment: 'live',
      }),
    ).rejects.toThrow('No active TIRAMIS client configuration matches');
  });

  it('rejects a missing key', async () => {
    const { service } = createService();

    await expect(service.validate(undefined)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects an invalid key', async () => {
    const { service, apiKeyRepository } = createService();
    apiKeyRepository.findOne.mockResolvedValue(null);

    await expect(service.validate('bad-key')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects disabled, revoked, and expired keys', async () => {
    const rawKey = 'tms_test';
    const base = {
      id: 'key-id',
      apiKey: rawKey,
      serviceName: 'insurance-portal-service',
      scopes: ['tiramis:submit'],
    };

    for (const row of [
      { ...base, isActive: false, revokedAt: null, expiresAt: null },
      { ...base, isActive: true, revokedAt: new Date(), expiresAt: null },
      {
        ...base,
        isActive: true,
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1000),
      },
    ]) {
      const { service, apiKeyRepository } = createService();
      apiKeyRepository.findOne.mockResolvedValue(row);

      await expect(service.validate(rawKey)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    }
  });

  it('returns a service principal and records last use for a valid key', async () => {
    const rawKey = 'tms_test';
    const { service, apiKeyRepository } = createService();
    apiKeyRepository.findOne.mockResolvedValue({
      id: 'key-id',
      apiKey: rawKey,
      serviceName: 'insurance-portal-service',
      scopes: ['tiramis:submit'],
      tenantCompanyCode: 'ICC110',
      tenantSystemCode: 'LSYS_ALLIANCE_003',
      tenantEnvironment: 'live',
      isActive: true,
      revokedAt: null,
      expiresAt: null,
    });

    const principal = await service.validate(rawKey, ['tiramis:submit']);

    expect(principal).toEqual({
      id: 'key-id',
      serviceName: 'insurance-portal-service',
      scopes: ['tiramis:submit'],
      tenantCompanyCode: 'ICC110',
      tenantSystemCode: 'LSYS_ALLIANCE_003',
      tenantEnvironment: 'live',
    });
    expect(apiKeyRepository.update).toHaveBeenCalledWith('key-id', {
      lastUsedAt: expect.any(Date),
    });
  });
});
