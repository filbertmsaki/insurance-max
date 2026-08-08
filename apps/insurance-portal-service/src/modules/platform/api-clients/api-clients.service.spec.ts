jest.mock('@insurance-max/portal-shared/utils/hash.util', () => ({
  comparePasswords: jest.fn(),
  hashPassword: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';

import {
  comparePasswords,
  hashPassword,
} from '@insurance-max/portal-shared/utils/hash.util';
import { ApiClientStatus } from '@insurance-max/contracts';

import { SubscriptionLimitService } from '../saas-billing/services/subscription-limit.service';
import { ApiClientsService } from './api-clients.service';
import { ApiClient } from './entities/api-client.entity';
import { ApiClientUsageEvent } from './entities/api-client-usage-event.entity';

describe('ApiClientsService', () => {
  let service: ApiClientsService;
  let apiClientRepo: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    findOneBy: jest.Mock;
    update: jest.Mock;
  };
  let usageEventRepo: {
    create: jest.Mock;
    save: jest.Mock;
    count: jest.Mock;
    find: jest.Mock;
  };
  let configService: jest.Mocked<ConfigService>;
  let subscriptionLimitService: jest.Mocked<SubscriptionLimitService>;

  beforeEach(async () => {
    apiClientRepo = {
      create: jest.fn().mockImplementation((value) => value),
      save: jest.fn().mockImplementation(async (value) => ({
        id: 'api-client-id',
        created_at: new Date(),
        updated_at: new Date(),
        usage_count: '0',
        ...value,
      })),
      findOne: jest.fn(),
      findOneBy: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    usageEventRepo = {
      create: jest.fn().mockImplementation((value) => value),
      save: jest.fn().mockResolvedValue(undefined),
      count: jest.fn().mockResolvedValue(0),
      find: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiClientsService,
        { provide: getRepositoryToken(ApiClient), useValue: apiClientRepo },
        {
          provide: getRepositoryToken(ApiClientUsageEvent),
          useValue: usageEventRepo,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest
              .fn()
              .mockImplementation((key: string, fallback?: unknown) => {
                const config: Record<string, unknown> = {
                  API_KEYS_ENABLED: true,
                  API_KEY_REQUIRE_IP_ALLOWLIST: true,
                  API_KEY_MAX_IPS_PER_KEY: 1,
                  API_KEY_DEFAULT_RATE_LIMIT_PER_MINUTE: 60,
                  API_KEY_ROTATION_GRACE_HOURS: 24,
                  API_KEY_MAX_VALIDITY_DAYS: 365,
                };
                return config[key] ?? fallback;
              }),
          },
        },
        {
          provide: SubscriptionLimitService,
          useValue: {
            assertCapacity: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get(ApiClientsService);
    configService = module.get(ConfigService);
    subscriptionLimitService = module.get(SubscriptionLimitService);
    jest.mocked(hashPassword).mockResolvedValue('hashed-secret');
    jest.mocked(comparePasswords).mockResolvedValue(true);
  });

  it('rejects API client creation without an allowlisted IP when policy requires it', async () => {
    await expect(
      service.create({
        name: 'Partner Integration',
        companyId: 'company-1',
        ownerUserId: 'user-1',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(subscriptionLimitService.assertCapacity).toHaveBeenCalledWith(
      'company-1',
      'api_clients.max',
    );
    expect(apiClientRepo.save).not.toHaveBeenCalled();
  });

  it('accepts CIDR allowlist rules and records the last user agent', async () => {
    apiClientRepo.findOne.mockResolvedValue({
      id: 'client-1',
      client_id: 'iam_client',
      company_id: 'company-1',
      owner_user_id: 'user-1',
      name: 'Partner Integration',
      key_prefix: 'IMX_TEST',
      scopes: ['claims:read'],
      status: ApiClientStatus.ACTIVE,
      client_type: 'TENANT_INTEGRATION',
      environment: 'PRODUCTION',
      ip_whitelist: ['203.0.113.0/24'],
      rate_limit_per_minute: 60,
      last_used_at: null,
      last_used_ip: null,
      last_used_user_agent: null,
      usage_count: '0',
      expires_at: null,
      client_secret_hash: 'hash',
      previous_secret_hash: null,
      previous_secret_valid_until: null,
      rotated_at: null,
      compromised_at: null,
      revoked_reason: null,
      description: null,
      created_at: new Date(),
      updated_at: new Date(),
    });

    const client = await service.validateApiKey('iam_client', 'secret', {
      ipAddress: '203.0.113.25',
      method: 'GET',
      requestPath: '/api/v1/claims',
      userAgent: 'JestAgent/1.0',
      requiredScopes: ['claims:read'],
    });

    expect(client.status).toBe(ApiClientStatus.ACTIVE);
    expect(apiClientRepo.update).toHaveBeenCalledWith(
      'client-1',
      expect.objectContaining({
        last_used_ip: '203.0.113.25',
        last_used_user_agent: 'JestAgent/1.0',
      }),
    );
  });

  it('rejects API keys that are missing required scopes', async () => {
    apiClientRepo.findOne.mockResolvedValue({
      id: 'client-1',
      client_id: 'iam_client',
      company_id: 'company-1',
      owner_user_id: 'user-1',
      name: 'Partner Integration',
      key_prefix: 'IMX_TEST',
      scopes: ['claims:read'],
      status: ApiClientStatus.ACTIVE,
      client_type: 'TENANT_INTEGRATION',
      environment: 'PRODUCTION',
      ip_whitelist: ['203.0.113.25'],
      rate_limit_per_minute: 60,
      last_used_at: null,
      last_used_ip: null,
      last_used_user_agent: null,
      usage_count: '0',
      expires_at: null,
      client_secret_hash: 'hash',
      previous_secret_hash: null,
      previous_secret_valid_until: null,
      rotated_at: null,
      compromised_at: null,
      revoked_reason: null,
      description: null,
      created_at: new Date(),
      updated_at: new Date(),
    });

    await expect(
      service.validateApiKey('iam_client', 'secret', {
        ipAddress: '203.0.113.25',
        requiredScopes: ['claims:write'],
      }),
    ).rejects.toThrow(UnauthorizedException);

    expect(usageEventRepo.save).toHaveBeenCalled();
  });
});
