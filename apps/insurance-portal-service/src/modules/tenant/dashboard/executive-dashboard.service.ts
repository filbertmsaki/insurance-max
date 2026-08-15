import { Injectable } from '@nestjs/common';

import { AnyPermissions } from '@insurance-max/portal-shared';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

import { AnalyticsMetricService } from '../analytics/services/analytics-metric.service';
import { DashboardCacheService } from './dashboard-cache.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';

@Injectable()
export class ExecutiveDashboardService {
  constructor(
    private readonly analyticsMetricService: AnalyticsMetricService,
    private readonly dashboardCacheService: DashboardCacheService,
  ) {}

  async getExecutive(user: AuthenticatedUser, query: DashboardQueryDto) {
    return this.dashboardCacheService.getOrSet(
      'executive',
      user,
      query,
      async () => {
        return this.analyticsMetricService.getExecutiveDashboard(user);
      },
    );
  }
}
