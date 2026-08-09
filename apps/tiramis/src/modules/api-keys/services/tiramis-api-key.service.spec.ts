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

    return {
      service: new TiramisApiKeyService(
        apiKeyRepository as any,
        auditRepository as any,
      ),
      apiKeyRepository,
      auditRepository,
    };
  }

  it('creates a key and stores the plain API key value', async () => {
    const { service, apiKeyRepository } = createService();

    const created = await service.create({
      name: 'Portal',
      serviceName: 'insurance-portal-service',
      scopes: ['tiramis:submit'],
    });

    expect(created.apiKey).toMatch(/^tms_/);
    expect(apiKeyRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: created.apiKey,
        serviceName: 'insurance-portal-service',
      }),
    );
    expect(apiKeyRepository.save.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        serviceName: 'insurance-portal-service',
        scopes: ['tiramis:submit'],
      }),
    );
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
      isActive: true,
      revokedAt: null,
      expiresAt: null,
    });

    const principal = await service.validate(rawKey, ['tiramis:submit']);

    expect(principal).toEqual({
      id: 'key-id',
      serviceName: 'insurance-portal-service',
      scopes: ['tiramis:submit'],
    });
    expect(apiKeyRepository.update).toHaveBeenCalledWith('key-id', {
      lastUsedAt: expect.any(Date),
    });
  });
});
