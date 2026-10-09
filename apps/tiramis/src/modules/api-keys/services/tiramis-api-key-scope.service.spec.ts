import { createHash } from 'node:crypto';
import { ForbiddenException } from '@nestjs/common';

import { TiramisApiKeyService } from './tiramis-api-key.service';

describe('TiramisApiKeyService capability scopes', () => {
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

  function validLegacyKey(scopes: string[]) {
    const rawKey = 'tms_scope_test_key';
    return {
      rawKey,
      row: {
        id: 'key-id',
        apiKey: rawKey,
        apiKeyHash: null,
        serviceName: 'portal',
        scopes,
        allowedIps: ['10.1.2.3'],
        isActive: true,
        revokedAt: null,
        expiresAt: null,
        tenantCompanyCode: null,
        tenantSystemCode: null,
        tenantEnvironment: null,
        clientConfigurationId: null,
      },
    };
  }

  it('rejects a key when an endpoint capability is missing', async () => {
    const { service, apiKeyRepository, auditRepository } = createService();
    const { rawKey, row } = validLegacyKey(['tiramis:read']);
    apiKeyRepository.findOne.mockResolvedValue(row);

    await expect(
      service.validate(rawKey, ['tiramis:submit'], {
        ipAddress: '10.1.2.3',
        method: 'POST',
        path: '/tiramis/policies/submit',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(apiKeyRepository.update).not.toHaveBeenCalled();
    expect(auditRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: 'FAILED',
        metadata: expect.objectContaining({ reason: 'INSUFFICIENT_SCOPE' }),
      }),
    );
  });

  it('accepts a key with the endpoint capability and returns its scopes', async () => {
    const { service, apiKeyRepository } = createService();
    const { rawKey, row } = validLegacyKey(['tiramis:submit', 'tiramis:read']);
    apiKeyRepository.findOne.mockResolvedValue(row);

    await expect(
      service.validate(rawKey, ['tiramis:submit'], {
        ipAddress: '10.1.2.3',
      }),
    ).resolves.toEqual({
      id: 'key-id',
      serviceName: 'portal',
      allowedIps: ['10.1.2.3'],
      scopes: ['tiramis:submit', 'tiramis:read'],
      tenantCompanyCode: null,
      tenantSystemCode: null,
      tenantEnvironment: null,
      clientConfigurationId: null,
    });
    expect(apiKeyRepository.update).toHaveBeenCalledWith('key-id', {
      lastUsedAt: expect.any(Date),
    });
  });

  it('rejects API-key authentication for administrator-only capabilities', async () => {
    const { service, apiKeyRepository } = createService();
    const { rawKey, row } = validLegacyKey(['tiramis:read']);
    apiKeyRepository.findOne.mockResolvedValue(row);

    await expect(
      service.validate(rawKey, ['tiramis:admin'], {
        ipAddress: '10.1.2.3',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('uses constant-time hash validation for newly hashed credentials', async () => {
    const { service, apiKeyRepository } = createService();
    const rawKey = 'tms_hashed_scope_test';
    apiKeyRepository.findOne.mockResolvedValue({
      id: 'key-id',
      apiKey: null,
      apiKeyHash: createHash('sha256').update(rawKey, 'utf8').digest('hex'),
      serviceName: 'portal',
      scopes: ['tiramis:read'],
      allowedIps: ['10.1.2.3'],
      isActive: true,
      revokedAt: null,
      expiresAt: null,
    });

    await expect(
      service.validate(rawKey, ['tiramis:read'], {
        ipAddress: '10.1.2.3',
      }),
    ).resolves.toMatchObject({ scopes: ['tiramis:read'] });
  });
});
