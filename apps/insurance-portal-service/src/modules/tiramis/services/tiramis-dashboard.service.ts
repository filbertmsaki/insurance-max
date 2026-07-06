import { Injectable } from '@nestjs/common';

import { TiramisDashboardQueryDto } from '../dto/tiramis-dashboard-query.dto';
import { TiramisNotificationRepository } from '../repositories/tiramis-notification.repository';
import { TiramisSubmissionTrackingRepository } from '../repositories/tiramis-submission-tracking.repository';

@Injectable()
export class TiramisDashboardService {
  constructor(
    private readonly trackingRepository: TiramisSubmissionTrackingRepository,
    private readonly notificationRepository: TiramisNotificationRepository,
  ) {}

  async getDashboard(
    query: TiramisDashboardQueryDto,
    scope?: { companyId?: string | null; canAccessAllCompanies?: boolean },
  ) {
    const submissions = await this.trackingRepository.findDashboardSubmissionsScoped(
      query,
      scope,
    );
    const notifications = await this.notificationRepository.findRecent(10, scope);

    return {
      success: true,
      ...submissions,
      recentNotifications: notifications,
    };
  }

  async getHealth(
    query: TiramisDashboardQueryDto,
    scope?: { companyId?: string | null; canAccessAllCompanies?: boolean },
  ) {
    const dashboard = await this.getDashboard(query, scope);

    return {
      success: true,
      healthy: true,
      summary: dashboard.meta,
    };
  }

  async getTrackingTimeline(
    localTrackingId: string,
    scope?: { companyId?: string | null; canAccessAllCompanies?: boolean },
  ) {
    const submission = await this.trackingRepository.findById(localTrackingId);
    const notifications = await this.notificationRepository.findByTrackingId(
      localTrackingId,
      scope,
    );

    return {
      success: true,
      localTrackingId,
      submission,
      auditLogs: [],
      notifications,
    };
  }
}
