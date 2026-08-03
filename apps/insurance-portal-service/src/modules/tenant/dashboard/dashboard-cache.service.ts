import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';

import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

import { RedisService } from '../../shared/redis/redis.service';
import type { DashboardQueryDto } from './dto/dashboard-query.dto';

@Injectable()
export class DashboardCacheService {
  private readonly enabled: boolean;
  private readonly ttlSeconds: number;

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {
    this.enabled =
      this.configService.get<string>('DASHBOARD_CACHE_ENABLED', 'true') !==
      'false';
    this.ttlSeconds = Number(
      this.configService.get<string>('DASHBOARD_CACHE_TTL_SECONDS', '60'),
    );
  }

  async getOrSet<T>(
    section: string,
    user: AuthenticatedUser,
    query: DashboardQueryDto,
    factory: () => Promise<T>,
  ): Promise<T> {
    if (!this.enabled) {
      return factory();
    }

    const key = this.buildKey(section, user, query);
    const cached = await this.redisService.getJson<T>(key);

    if (cached) {
      return cached;
    }

    const result = await factory();
    await this.redisService.setJson(key, result, this.ttlSeconds);
    return result;
  }

  private buildKey(
    section: string,
    user: AuthenticatedUser,
    query: DashboardQueryDto,
  ): string {
    const scopeFingerprint = createHash('sha256')
      .update(
        JSON.stringify({
          companyId: user.companyId,
          companyMembershipId: user.companyMembershipId,
          activeBranchId: user.activeBranchId,
          assignedBranchIds: [...(user.assignedBranchIds ?? [])].sort(),
          userId: user.id,
          userType: user.userType,
          permissions: [...(user.permissions ?? [])].sort(),
        }),
      )
      .digest('hex')
      .slice(0, 24);

    const filterFingerprint = createHash('sha256')
      .update(
        JSON.stringify({
          from: query.from ?? null,
          to: query.to ?? null,
          group_by: query.group_by ?? null,
          branch_id: query.branch_id ?? null,
          product_id: query.product_id ?? null,
          channel_type: query.channel_type ?? null,
          currency: query.currency ?? null,
          limit: query.limit ?? null,
        }),
      )
      .digest('hex')
      .slice(0, 24);

    return [
      'dashboard',
      section,
      user.companyId,
      scopeFingerprint,
      filterFingerprint,
    ].join(':');
  }
}
