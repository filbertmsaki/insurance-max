import type { ConfigService } from '@nestjs/config';

import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

import { RedisService } from '../../shared/redis/redis.service';
import { DashboardCacheService } from './dashboard-cache.service';
import type { DashboardQueryDto } from './dto/dashboard-query.dto';

describe('DashboardCacheService', () => {
  let service: DashboardCacheService;
  let redisService: jest.Mocked<RedisService>;

  const baseUser: AuthenticatedUser = {
    id: 'user-1',
    email: 'user@example.com',
    scope: 'company',
    userType: 'COMPANY_USER',
    companyId: 'company-1',
    companyName: 'Alliance',
    companyType: 'INSURANCE_COMPANY' as never,
    companyMembershipId: 'membership-1',
    activeBranchId: 'branch-1',
    assignedBranchIds: ['branch-1'],
    roles: ['USER'],
    permissions: ['dashboard:overview'],
  };

  beforeEach(() => {
    redisService = {
      getJson: jest.fn().mockResolvedValue(null),
      setJson: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<RedisService>;

    const configService = {
      get: jest.fn((key: string, fallback?: string) => {
        switch (key) {
          case 'DASHBOARD_CACHE_ENABLED':
            return 'true';
          case 'DASHBOARD_CACHE_TTL_SECONDS':
            return '60';
          default:
            return fallback;
        }
      }),
    } as unknown as ConfigService;

    service = new DashboardCacheService(
      redisService,
      configService,
    );
  });

  it('uses distinct cache keys for different scope and permissions', async () => {
    const query: DashboardQueryDto = {
      from: '2026-08-01',
      to: '2026-08-31',
      limit: 10,
    };

    await service.getOrSet(
      'overview',
      baseUser,
      query,
      async () => ({ ok: true }),
    );

    await service.getOrSet(
      'overview',
      {
        ...baseUser,
        assignedBranchIds: ['branch-1', 'branch-2'],
        permissions: ['dashboard:overview', 'dashboard:finance'],
      },
      query,
      async () => ({ ok: true }),
    );

    const firstKey = redisService.setJson.mock.calls[0][0];
    const secondKey = redisService.setJson.mock.calls[1][0];

    expect(firstKey).not.toBe(secondKey);
  });

  it('uses distinct cache keys for different dashboard filters', async () => {
    await service.getOrSet(
      'sales',
      baseUser,
      {
        from: '2026-08-01',
        to: '2026-08-31',
        currency: 'TZS',
      },
      async () => ({ ok: true }),
    );

    await service.getOrSet(
      'sales',
      baseUser,
      {
        from: '2026-08-01',
        to: '2026-08-31',
        currency: 'USD',
      },
      async () => ({ ok: true }),
    );

    const firstKey = redisService.setJson.mock.calls[0][0];
    const secondKey = redisService.setJson.mock.calls[1][0];

    expect(firstKey).not.toBe(secondKey);
  });
});
