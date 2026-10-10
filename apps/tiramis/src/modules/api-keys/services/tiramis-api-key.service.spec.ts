import { ForbiddenException } from '@nestjs/common';
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
    return {
      service: new TiramisApiKeyService(
        apiKeyRepository as any,
        auditRepository as any,
        { get: jest.fn((_: string, fallback?: unknown) => fallback) } as any,
      ),
      apiKeyRepository,
    };
  }

  it('creates a hashed system key with explicit capabilities and IP restrictions', async () => {
    const { service, apiKeyRepository } = createService();
    apiKeyRepository.findOne.mockResolvedValue(null);

    const created = await service.create({
      name: 'Portal',
      serviceName: 'insurance-portal-service',
      allowedIps: ['203.0.113.10'],
      scopes: ['tiramis:read', 'tiramis:submit'],
    });

    expect(created.apiKey).toMatch(/^tms_/);
    expect(apiKeyRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: null,
        apiKeyHash: expect.any(String),
        scopes: ['tiramis:read', 'tiramis:submit'],
        allowedIps: ['203.0.113.10'],
        tenantCompanyCode: null,
        tenantEnvironment: null,
        clientConfigurationId: null,
      }),
    );
    expect(created.apiKeyHash).toBeUndefined();
  });

  it('normalizes legacy tenant environment aliases when creating keys', async () => {
    const { service, apiKeyRepository } = createService();
    apiKeyRepository.findOne.mockResolvedValue(null);

    await service.create({
      name: 'Portal',
      serviceName: 'insurance-portal-service',
      allowedIps: ['203.0.113.10'],
      scopes: ['tiramis:read'],
      tenantEnvironment: 'live',
    });

    expect(apiKeyRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantEnvironment: 'production',
      }),
    );
  });

  it('rejects a second active system key for the same service', async () => {
    const { service, apiKeyRepository } = createService();
    apiKeyRepository.findOne.mockResolvedValue({ id: 'existing' });

    await expect(
      service.create({
        name: 'Portal',
        serviceName: 'insurance-portal-service',
        allowedIps: ['203.0.113.10'],
        scopes: ['tiramis:read'],
      }),
    ).rejects.toThrow('already has an active key');
    expect(apiKeyRepository.save).not.toHaveBeenCalled();
  });

  it('rejects a key missing a required endpoint scope', async () => {
    const { service, apiKeyRepository } = createService();
    const rawKey = 'tms_legacy_test';
    apiKeyRepository.findOne.mockResolvedValue({
      id: 'key-id',
      apiKey: rawKey,
      apiKeyHash: null,
      serviceName: 'portal',
      scopes: ['tiramis:read'],
      allowedIps: ['10.1.2.3'],
      isActive: true,
      expiresAt: null,
      revokedAt: null,
      tenantCompanyCode: '123456',
      tenantEnvironment: 'test',
      clientConfigurationId: 'configuration-id',
    });

    await expect(
      service.validate(rawKey, ['tiramis:submit'], { ipAddress: '10.1.2.3' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(apiKeyRepository.update).not.toHaveBeenCalled();
  });

  it('accepts an allowed scope from an allowed IP and returns the principal capabilities', async () => {
    const { service, apiKeyRepository } = createService();
    const rawKey = 'tms_legacy_test';
    apiKeyRepository.findOne.mockResolvedValue({
      id: 'key-id',
      apiKey: rawKey,
      apiKeyHash: null,
      serviceName: 'portal',
      scopes: ['tiramis:read', 'tiramis:submit'],
      allowedIps: ['10.1.2.3'],
      isActive: true,
      expiresAt: null,
      revokedAt: null,
      tenantCompanyCode: '123456',
      tenantEnvironment: 'test',
      clientConfigurationId: 'configuration-id',
    });

    await expect(
      service.validate(rawKey, ['tiramis:submit'], { ipAddress: '10.1.2.3' }),
    ).resolves.toEqual({
      id: 'key-id',
      serviceName: 'portal',
      allowedIps: ['10.1.2.3'],
      scopes: ['tiramis:read', 'tiramis:submit'],
      tenantCompanyCode: '123456',
      tenantEnvironment: 'uat',
      clientConfigurationId: 'configuration-id',
    });
  });

  it('rejects expired, disabled and revoked keys', async () => {
    const rawKey = 'tms_legacy_test';
    for (const state of [
      { isActive: false, revokedAt: null, expiresAt: null },
      { isActive: true, revokedAt: new Date(), expiresAt: null },
      { isActive: true, revokedAt: null, expiresAt: new Date(Date.now() - 1) },
    ]) {
      const { service, apiKeyRepository } = createService();
      apiKeyRepository.findOne.mockResolvedValue({
        id: 'key-id',
        apiKey: rawKey,
        apiKeyHash: null,
        serviceName: 'portal',
        scopes: ['tiramis:read'],
        allowedIps: ['10.1.2.3'],
        ...state,
      });
      await expect(
        service.validate(rawKey, ['tiramis:read'], { ipAddress: '10.1.2.3' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    }
  });
});
